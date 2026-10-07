// TargetWise's fixed-destination stdio-to-HTTP bridge. No local file access,
// subprocesses, telemetry, credential persistence, or third-party dependencies.
export const ENDPOINT = "https://targetwise.ai/api/mcp";
export const MAX_BYTES = 1_048_576;
const REQUEST_LIMIT = 65_536;
const error = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

async function boundedJson(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("invalid_response");
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("response_too_large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_response");
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("response_too_large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createBridge({ apiKey, fetcher = globalThis.fetch, timeoutMs = 40_000 }) {
  let protocolVersion = "2025-11-25";
  let initialized = false;
  const key = String(apiKey || "").trim();
  return async function handle(message) {
    const hasId = object(message) && Object.hasOwn(message, "id");
    const id = hasId ? message.id : null;
    if (!object(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string" ||
        (hasId && typeof id !== "string" && !(typeof id === "number" && Number.isSafeInteger(id)))) {
      return error(null, -32600, "Invalid JSON-RPC request.");
    }
    // Notifications never receive a JSON-RPC response.
    if (!hasId && !["notifications/initialized", "notifications/cancelled"].includes(message.method)) return null;
    if (!key || /\s/.test(key) || key.startsWith("__encrypted__:") || key.includes("${")) {
      return hasId ? error(id, -32001, "Set your TargetWise workspace API key in the extension settings, then reconnect.") : null;
    }
    if (!initialized && message.method !== "initialize") {
      return hasId ? error(id, -32002, "Initialize the TargetWise connector before calling tools.") : null;
    }
    const body = JSON.stringify(message);
    if (Buffer.byteLength(body) > REQUEST_LIMIT) return hasId ? error(id, -32600, "Request exceeds the 64 KiB limit.") : null;
    try {
      const response = await fetcher(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(message.method === "initialize" ? {} : { "MCP-Protocol-Version": protocolVersion }),
        },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!hasId) { await response.body?.cancel(); return null; }
      if (!response.ok) {
        await response.body?.cancel();
        const reason = response.status === 401 ? "The TargetWise API key is invalid, expired or revoked. Update it in extension settings."
          : response.status === 403 ? "This workspace does not have access to the requested operation."
          : response.status === 429 ? "The workspace rate limit has been reached. Wait before making another request."
          : `TargetWise returned HTTP ${response.status}. Check workspace access and service availability before retrying.`;
        return error(id, -32001, reason);
      }
      const result = await boundedJson(response);
      if (!object(result) || result.jsonrpc !== "2.0" || result.id !== id ||
          (Object.hasOwn(result, "result") === Object.hasOwn(result, "error"))) throw new Error("invalid_response");
      if (message.method === "initialize" && result.result) {
        if (result.result.protocolVersion !== "2025-11-25") throw new Error("unsupported_protocol");
        protocolVersion = result.result.protocolVersion;
        initialized = true;
      }
      return result;
    } catch {
      // Never echo network exception text, headers, request arguments or secrets.
      // No automatic retry: data lookups can consume credits.
      return hasId ? error(id, -32000, "TargetWise could not complete the request. Check the connection and workspace usage before retrying.") : null;
    }
  };
}

export async function runStdio(input, output, options) {
  const handle = createBridge(options);
  let pending = Buffer.alloc(0);
  let discarding = false;
  const send = async message => {
    if (!message) return;
    if (!output.write(`${JSON.stringify(message)}\n`)) {
      await new Promise(resolve => output.once("drain", resolve));
    }
  };
  // Sequential processing preserves initialize/notification order and bounds
  // in-flight calls; stream backpressure keeps a fast client from growing a queue.
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    let start = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 10) continue;
      const segment = bytes.subarray(start, i);
      if (!discarding) {
        if (pending.length + segment.length > REQUEST_LIMIT) {
          await send(error(null, -32600, "Request exceeds the 64 KiB limit."));
        } else {
          const line = Buffer.concat([pending, segment]).toString("utf8").trim();
          if (line) {
            let message;
            try { message = JSON.parse(line); }
            catch { await send(error(null, -32700, "Invalid JSON.")); }
            if (message !== undefined) await send(await handle(message));
          }
        }
      }
      pending = Buffer.alloc(0); discarding = false; start = i + 1;
    }
    if (!discarding) {
      const tail = bytes.subarray(start);
      if (pending.length + tail.length > REQUEST_LIMIT) {
        pending = Buffer.alloc(0); discarding = true;
        await send(error(null, -32600, "Request exceeds the 64 KiB limit."));
      } else { pending = Buffer.concat([pending, tail]); }
    }
  }
  if (pending.length) await send(error(null, -32700, "Incomplete JSON-RPC line; messages must end with a newline."));
}
