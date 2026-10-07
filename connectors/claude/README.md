# TargetWise for Claude

![TargetWise](icon.png)

TargetWise is a B2B data enrichment platform that helps sales, revenue operations and AI teams turn incomplete company and contact records into usable business data. It combines waterfall contact enrichment with company intelligence and delivers results through its web platform, API and MCP connectors.

Setup: https://targetwise.ai/developers/claude

## Claude Desktop

Download https://targetwise.ai/downloads/targetwise-claude.mcpb. In Claude Desktop, open Settings → Extensions → Advanced settings → Install Extension and select the file. Enter a dedicated TargetWise workspace key in the extension's API key setting, then enable TargetWise in your conversation. Organisation policy may require an administrator to approve the extension. This is a custom extension, not an Anthropic-reviewed directory listing.

## Claude web

Add a custom web connector in Customize → Connectors (or Settings → Connectors in older layouts). Use the name TargetWise and URL https://targetwise.ai/api/mcp. Select No sign in for OAuth, then set the required Authorization request header to `Bearer YOUR_TARGETWISE_KEY`. TargetWise still requires that API key. If request headers are unavailable in your Claude account, use the Desktop extension or Claude Code.

## Claude Code

Merge the downloadable https://targetwise.ai/downloads/targetwise-claude-code.json into your project's `.mcp.json`. It references `TARGETWISE_API_KEY` from your environment, so the configuration contains no secret. Start Claude Code with the variable set by your secret manager and approve the connector in `/mcp`.

## Verify and use

First ask: “List the TargetWise tools available to you. Do not run a data lookup.” Discovery uses no enrichment credits. Then use one known business record you are permitted to query. Start with a work-email lookup and explicitly avoid phone enrichment unless needed. Inspect usage in TargetWise after the request.

The gateway advertises eleven tools. Tool discovery is not a promise of entitlement: paid plans currently enable email and phone results, while other operations depend on evaluation allowances and commercial access. Never invent missing data. Lookups can consume credits, including repeated calls; the extension does not automatically retry.

## Credentials and data

Claude stores the sensitive API key setting in its credential storage. The extension reads that setting through its process environment and forwards it solely in the Authorization header to the fixed TargetWise HTTPS endpoint. It refuses redirects, does not persist keys or results, and does not access local files, launch other programs, or send telemetry. TargetWise applies the existing workspace authentication, billing, rate limits and account security checks. Claude and TargetWise receive the inputs and returned business data used in the conversation. Policies: https://targetwise.ai/legal/privacy and https://targetwise.ai/legal/terms.

Revoke the dedicated key in TargetWise Dashboard → Developers to stop access immediately. Remove the extension or custom connector in Claude. A shared Team/Enterprise request-header credential uses the same TargetWise workspace for all users; allocate it accordingly.

## Build and update

The bundle is a ZIP-format MCPB containing manifest.json, this README, the supplied TargetWise brand icon and two dependency-free Node.js modules plus the MIT licence. Run `python3 scripts/package-claude-connector.py` from the site repository to create the download and SHA-256 checksum. Install a new bundle manually when its version changes. Unit and gateway integration tests live in tests/claude-connector.test.mjs and tests/claude-connector-gateway.test.mjs.
