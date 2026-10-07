import { runStdio } from "./bridge.mjs";

runStdio(process.stdin, process.stdout, { apiKey: process.env.TARGETWISE_API_KEY })
  .catch(() => { process.stderr.write("TargetWise connector stopped. Reconnect in extension settings.\n"); process.exitCode = 1; });
