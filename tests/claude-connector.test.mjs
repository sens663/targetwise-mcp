import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { readFile } from "node:fs/promises";
import { createBridge, runStdio, ENDPOINT, MAX_BYTES } from "../connectors/claude/server/bridge.mjs";

const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "claude-test", version: "1.0" } } };
const list = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
const fixture = (id, result) => Response.json({ jsonrpc: "2.0", id, result });
const initResponse = () => fixture(1, { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "targetwise", version: "1.0.0" } });

test("refuses missing, unresolved and encrypted credentials without making any request", async () => {
  for (const apiKey of ["", "${user_config.api_key}", "__encrypted__:ciphertext", "Bearer wrong"]) {
    const bridge = createBridge({ apiKey, fetcher: () => assert.fail("must not send invalid credentials") });
    assert.equal((await bridge(initialize)).error.code, -32001);
    assert.equal(await bridge({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  }
});

test("authenticates to a fixed HTTPS destination, negotiates protocol and never redirects", async () => {
  const calls = [];
  const bridge = createBridge({ apiKey: "fixture-key", fetcher: async (url, options) => {
    assert.equal(url, ENDPOINT); assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer fixture-key");
    assert.equal(new URL(url).search, ""); assert.ok(!options.body.includes("fixture-key"));
    const message = JSON.parse(options.body); calls.push(message.method);
    if (message.method === "initialize") { assert.equal(options.headers["MCP-Protocol-Version"], undefined); return initResponse(); }
    assert.equal(options.headers["MCP-Protocol-Version"], "2025-11-25");
    if (message.method.startsWith("notifications/")) return new Response(null, { status: 202 });
    return fixture(message.id, { tools: [{ name: "targetwise_find_work_email" }] });
  } });
  assert.equal((await bridge(list)).error.code, -32002);
  assert.ok((await bridge(initialize)).result);
  assert.equal(await bridge({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal((await bridge(list)).result.tools.length, 1);
  assert.deepEqual(calls, ["initialize", "notifications/initialized", "tools/list"]);
});

test("returns revoked-key errors without exposing body or retrying", async () => {
  let calls = 0;
  const bridge = createBridge({ apiKey: "secret-fixture", fetcher: async () => { calls++; return new Response("secret-fixture", { status: 401 }); } });
  const response = await bridge(initialize);
  assert.match(response.error.message, /revoked/); assert.ok(!JSON.stringify(response).includes("secret-fixture")); assert.equal(calls, 1);
});

test("rejects non-JSON, mismatched IDs, oversized and unsupported initialization responses", async () => {
  for (const response of [new Response("<html>sign in</html>"), fixture(9, {}), fixture(1, { protocolVersion: "unsupported" }), new Response("{}", { headers: {"Content-Type":"application/json", "Content-Length":String(MAX_BYTES + 1)} })]) {
    const bridge = createBridge({ apiKey: "fixture", fetcher: async () => response });
    assert.equal((await bridge(initialize)).error.code, -32000);
  }
});

test("bounds chunked responses without relying on Content-Length", async () => {
  const bridge = createBridge({ apiKey: "fixture", fetcher: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_BYTES + 1)); c.close(); } }), {headers:{"Content-Type":"application/json"}}) });
  assert.equal((await bridge(initialize)).error.code, -32000);
});

test("preserves metering and entitlement errors in tool results without a retry", async () => {
  let calls = 0;
  const result = { content: [{ type: "text", text: "credits_exhausted" }], isError: true };
  const bridge = createBridge({ apiKey: "fixture", fetcher: async () => ++calls === 1 ? initResponse() : fixture(3, result) });
  await bridge(initialize);
  const response = await bridge({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "targetwise_find_work_email", arguments: {} } });
  assert.deepEqual(response.result, result); assert.equal(calls, 2);
});

test("network failures never echo exception credentials or retry a charged call", async () => {
  let count = 0;
  const bridge = createBridge({ apiKey: "private-test-key", fetcher: async () => {count++; throw new Error("private-test-key");} });
  const response = await bridge(initialize);
  assert.equal(count, 1); assert.ok(!JSON.stringify(response).includes("private-test-key"));
});

test("request validation rejects arrays, null IDs, invalid JSON-RPC and oversized arguments", async () => {
  const bridge = createBridge({ apiKey: "fixture", fetcher: async () => initResponse() });
  for (const message of [[], null, {...list,id:null}, {...list,jsonrpc:"1.0"}, {...list,id:1.5}]) assert.equal((await bridge(message)).error.code, -32600);
  await bridge(initialize);
  assert.equal((await bridge({...list,params:{large:"x".repeat(65536)}})).error.code, -32600);
});

test("stdio handles fragmented UTF-8, notification ordering, malformed input and oversized lines", async () => {
  const init = {...initialize,params:{...initialize.params,clientInfo:{name:"Claude ț",version:"1.0"}}};
  const bytes = Buffer.from(JSON.stringify(init)+"\n");
  const split = bytes.indexOf(Buffer.from("ț")) + 1;
  const input = Readable.from([bytes.subarray(0,split),bytes.subarray(split),Buffer.from('{"jsonrpc":"2.0","method":"notifications/initialized"}\n'),Buffer.from("bad\n"),Buffer.from("x".repeat(70000)),Buffer.from("\n"+JSON.stringify(list)+"\n")]);
  let output = "", calls = 0;
  const sink = new Writable({ write(chunk, _, done) { output += chunk; done(); } });
  await runStdio(input, sink, {apiKey:"fixture",fetcher:async (_,opts)=> {
    const message=JSON.parse(opts.body); calls++;
    if(message.method==="initialize"){assert.equal(message.params.clientInfo.name,"Claude ț");return initResponse();}
    if(message.method.startsWith("notifications/"))return new Response(null,{status:202});
    return fixture(message.id,{tools:[]});
  }});
  const responses=output.trim().split("\n").map(JSON.parse);
  assert.equal(responses.length,4); assert.ok(responses[0].result); assert.equal(responses[1].error.code,-32700); assert.equal(responses[2].error.code,-32600);assert.deepEqual(responses[3].result,{tools:[]});assert.equal(calls,3);
});

test("bundle config stores credentials as sensitive settings and Code config only has an environment reference", async () => {
  const manifest=JSON.parse(await readFile(new URL('../connectors/claude/manifest.json',import.meta.url)));
  assert.equal(manifest.name,"targetwise");assert.equal(manifest.user_config.api_key.sensitive,true);assert.equal(manifest.user_config.api_key.required,true);
  assert.equal(manifest.server.mcp_config.env.TARGETWISE_API_KEY,"${user_config.api_key}");assert.ok(!JSON.stringify(manifest.server.mcp_config.args).includes("api_key"));
  const config=JSON.parse(await readFile(new URL('../.mcp.json',import.meta.url)));
  assert.equal(config.mcpServers.targetwise.type,"http");assert.equal(config.mcpServers.targetwise.headers.Authorization,"Bearer ${TARGETWISE_API_KEY}");
});

