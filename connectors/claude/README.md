# TargetWise for Claude

![TargetWise](icon.png)

TargetWise is a B2B data enrichment platform that helps sales, revenue operations and AI teams turn incomplete company and contact records into usable business data. It combines waterfall contact enrichment with company intelligence and delivers results through its web platform, API and MCP connectors.

Setup: https://targetwise.ai/developers/claude

## Claude plugin

This folder is a self-contained Claude plugin: `.claude-plugin/plugin.json` declares the listing, supplied TargetWise icon, local MCP server and sensitive API key setting. It runs the included dependency-free bridge with Node.js 20 or newer. The bridge connects to TargetWise's hosted API. Local MCP tools work in Claude Code and compatible local Cowork environments; they do not run in Claude web chat.

Install from TargetWise's GitHub marketplace in Claude Code:

```text
/plugin marketplace add sens663/targetwise-mcp
/plugin install targetwise@targetwise
```

Create a dedicated key in TargetWise Dashboard → Developers and enter it when Claude prompts for **TargetWise API key**. Enter only the key, without `Bearer`. Enable the plugin and confirm its MCP server is available. Use a current Claude version with plugin `userConfig` support. This installation does not require a pre-existing API key in your machine's environment.

This is TargetWise's own marketplace. It is not an approved listing in Anthropic's directory. Directory submission uses `sens663/targetwise-mcp`, branch `main`, plugin path `connectors/claude` at https://claude.ai/directory/manage. The standalone Desktop bundle below remains a separate manual installation option.

## Claude Desktop

Download https://targetwise.ai/downloads/targetwise-claude.mcpb. In Claude Desktop, open Settings → Extensions → Advanced settings → Install Extension and select the file. Enter a dedicated TargetWise workspace key in the extension's API key setting, then enable TargetWise in your conversation. Organisation policy may require an administrator to approve the extension. This is a custom extension, not an Anthropic-reviewed directory listing.

## Claude web

TargetWise's customer-key endpoint uses a workspace bearer key. Claude web's static request-header authentication is a limited organizational feature, so availability depends on your account. Where it is enabled, use https://targetwise.ai/api/mcp with the Authorization header `Bearer YOUR_TARGETWISE_KEY`. If your account requires OAuth and does not offer custom request headers, use the local plugin or Desktop extension. The local plugin does not add OAuth to the hosted service.

## Claude Code without the plugin

Merge the downloadable https://targetwise.ai/downloads/targetwise-claude-code.json into your project's `.mcp.json`. It references `TARGETWISE_API_KEY` from your environment, so the configuration contains no secret. Start Claude Code with the variable set by your secret manager and approve the connector in `/mcp`.

## Verify and use

First ask: “List the TargetWise tools available to you. Do not run a data lookup.” Discovery uses no enrichment credits. Then use one known business record you are permitted to query. Start with a work-email lookup and explicitly avoid phone enrichment unless needed. Inspect usage in TargetWise after the request.

The gateway advertises eleven tools. Tool discovery is not a promise of entitlement: paid plans currently enable email and phone results, while other operations depend on evaluation allowances and commercial access. Never invent missing data. Lookups can consume credits, including repeated calls; the extension does not automatically retry.

| Tool | Purpose |
| --- | --- |
| `targetwise_find_companies` | Resolve a company name, website or registration number |
| `targetwise_search_companies` | Search companies using supported business filters |
| `targetwise_search_contacts` | Find professional candidates at company domains |
| `targetwise_search_employees` | Search employees by company, person, role or seniority |
| `targetwise_get_employee` | Retrieve one selected employee's available details |
| `targetwise_autocomplete_company` | Populate company fields from an identity lookup |
| `targetwise_enrich_company` | Retrieve one selected company's available profile |
| `targetwise_enrich_contact` | Retrieve requested contact fields and professional context |
| `targetwise_find_work_email` | Look up an available work email for a known professional |
| `targetwise_find_phone` | Look up an available business phone for a known professional |
| `targetwise_reverse_email_lookup` | Resolve a business email into available person and employer context |

Example requests:

- “Find the company behind example.com. Show the candidate before enrichment.”
- “Find employees at this company with the job title I specify. Return only the first page.”
- “Find the work email for this known professional. Do not request a phone number.”

The connector retrieves data; it does not send outreach or modify a CRM. Returned business contact records can contain personal data. Use records only where you have permission and a valid business purpose.

## Credentials and data

Claude stores the sensitive API key setting in its credential storage. Claude injects this declared setting into the bridge's process environment; the plugin does not search for credentials on your machine. The bridge forwards the key solely in the Authorization header to the fixed destination https://targetwise.ai/api/mcp. Request arguments, such as company domains, names and business contact identifiers, go to that endpoint; returned business data comes back to Claude. No other network destination is used by the bridge.

The bridge refuses redirects, does not persist keys or results, and does not access local files, launch other programs, or send telemetry. It keeps request and response data in process memory only while handling calls. TargetWise applies the existing workspace authentication, billing, rate limits and account security checks. Claude and TargetWise process the inputs and returned business data under their respective policies; the bridge's lack of persistence does not imply zero retention by those services. TargetWise's hosted-service retention and deletion practices are described at https://targetwise.ai/legal/privacy. Service terms: https://targetwise.ai/legal/terms. Support: https://targetwise.ai/company/contact.

Revoke the dedicated key in TargetWise Dashboard → Developers to stop access immediately. Uninstall the plugin with `/plugin uninstall targetwise@targetwise`, or remove the extension or custom connector in Claude. A shared Team/Enterprise request-header credential uses the same TargetWise workspace for all users; allocate it accordingly.

## Build and update

Validate the plugin from the repository root with `claude plugin validate ./connectors/claude`. Run the bridge checks with `node --test tests/claude-connector.test.mjs`. The developer portal also performs its own validation and security review against a particular commit; local validation is not directory approval.

The separately distributed Desktop bundle is a ZIP-format MCPB containing manifest.json, this README, the supplied TargetWise brand icon, two dependency-free Node.js modules and the MIT licence. Run `python3 scripts/package-claude-connector.py` from the repository root to build it. Install a new Desktop bundle manually when its version changes. Plugin releases update the version in `.claude-plugin/plugin.json` and are distributed through the configured marketplace or, after approval, Anthropic's directory.

The MIT license covers this plugin's bridge, configuration and documentation. It does not license TargetWise's hosted service or the returned business data.
