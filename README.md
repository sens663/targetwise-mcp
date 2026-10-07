# TargetWise MCP

![TargetWise](public/targetwise-connector-logo.png)

TargetWise is a B2B data enrichment platform that helps sales, revenue operations and AI teams turn incomplete company and contact records into usable business data. It combines waterfall contact enrichment with company intelligence and delivers results through its web platform, API and MCP connectors.

**Company and contact data for AI agents.** Connect to TargetWise over Streamable HTTP to find companies and employees, enrich selected records, and retrieve available work emails and business phones.

- **MCP endpoint:** https://targetwise.ai/api/mcp
- **Documentation:** https://targetwise.ai/developers/mcp
- **Product:** https://targetwise.ai/mcp/overview
- **Official registry name:** `ai.targetwise/targetwise`
- **Authentication:** a TargetWise workspace API key in the `Authorization: Bearer ...` header

This repository contains the official connection guide, client configurations, directory manifest and MIT-licensed Claude plugin and Desktop connector for the hosted TargetWise service. The hosted server implementation and database are not distributed in this repository.

## Start with one useful lookup

1. Create a TargetWise account at https://targetwise.ai and obtain a workspace API key from **Dashboard → Developers**.
2. Store the key in your client's secret store or the `TARGETWISE_API_KEY` environment variable.
3. Connect a client that supports Streamable HTTP and custom bearer headers.
4. Use bounded search, inspect the candidates, then enrich the selected company or professional.

Customer-key clients must use `/api/mcp`. The hosting platform reserves `/mcp`; it is not the customer-key endpoint.

### Claude plugin

Install the plugin from TargetWise's GitHub marketplace in Claude Code:

```text
/plugin marketplace add sens663/targetwise-mcp
/plugin install targetwise@targetwise
```

Enter a dedicated TargetWise workspace API key when prompted. The plugin marks the key as sensitive and uses Claude's credential storage. Node.js 20 or newer is required. Local MCP tools work in Claude Code and compatible local Cowork environments; they do not run in Claude web chat. See the [plugin README](connectors/claude/README.md) for tools, data handling and validation.

The plugin includes the TargetWise logo and company description. This is TargetWise's own marketplace, not an approved listing in Anthropic's directory. Official directory publication requires a separate submission and review through [Anthropic's developer portal](https://claude.ai/directory/manage).

### Claude Desktop and Claude web

Download the [TargetWise Claude Desktop extension](https://targetwise.ai/downloads/targetwise-claude.mcpb) and follow the [Claude setup guide](https://targetwise.ai/developers/claude). The package includes the TargetWise logo and company description. Enter a dedicated workspace API key in its sensitive API key setting.

The dependency-free Node.js bridge and manifest are in [`connectors/claude`](connectors/claude). It forwards requests only to the fixed TargetWise HTTPS endpoint, refuses redirects and does not read local files or run shell commands. Run `node --test tests/claude-connector.test.mjs` to check the bridge. Run `python3 scripts/package-claude-connector.py` from this repository's root to build the bundle.

Claude web accounts with custom request-header support can use the hosted MCP endpoint directly. The setup guide includes the required Authorization header. Directory submission and Anthropic approval are separate from downloading this custom extension.

### Claude Code

```sh
claude mcp add --transport http targetwise https://targetwise.ai/api/mcp \
  --header "Authorization: Bearer ${TARGETWISE_API_KEY}"
```

Alternatively, use the included `.mcp.json` project configuration. It reads `TARGETWISE_API_KEY` from the environment. Keep credentials out of version control.

### Cursor

In Cursor's MCP settings, configure a remote server with the endpoint and Authorization header. The included `cursor.mcp.json` uses Cursor's environment interpolation syntax.

### Gemini CLI

Install the included extension:

```sh
gemini extensions install https://github.com/sens663/targetwise-mcp
```

When prompted, enter your TargetWise workspace API key. The extension declares a sensitive setting, `TARGETWISE_API_KEY`, and uses it in the Bearer header. Gemini CLI stores sensitive extension settings in its system keychain. Calls still consume your TargetWise workspace credits.

Clients that require an OAuth authorization flow cannot connect directly to this bearer-key gateway. Use a client that supports custom authentication headers. Do not interpret directory publication as approval by an AI platform.

## Eleven tools

| Tool | Purpose |
| --- | --- |
| `targetwise_find_companies` | Resolve a company name, website or registration number into candidates |
| `targetwise_search_companies` | Find companies using supported business, location, industry or technology filters |
| `targetwise_search_contacts` | Find professional candidates at known company domains |
| `targetwise_search_employees` | Search employee records by company, person name, job title, department or seniority |
| `targetwise_get_employee` | Retrieve available details for one selected employee |
| `targetwise_autocomplete_company` | Populate company fields from an identity lookup |
| `targetwise_enrich_company` | Retrieve a profile for one selected company or supported identifier |
| `targetwise_enrich_contact` | Retrieve requested contact fields and available professional profile context |
| `targetwise_find_work_email` | Look up one known professional's available work email |
| `targetwise_find_phone` | Look up one known professional's available business phone |
| `targetwise_reverse_email_lookup` | Resolve one business email into available person and employer context |

Discovery definitions are published at https://targetwise.ai/.well-known/mcp/server-card.json. They are generated from the same tool definitions used by the running server.

## Registry and discovery

The official MCP Registry record is active at https://registry.modelcontextprotocol.io/v0.1/servers/ai.targetwise%2Ftargetwise/versions/latest. Directory review and client-gallery approval are separate from registry publication.

[![AllMCPs listing](https://allmcps.com/api/badge/targetwise?style=shield)](https://allmcps.com/mcp/targetwise)

## Where it fits

- **Enterprise account research:** identify a company and add business context to a brief.
- **Revenue operations:** enrich selected records before applying your CRM's validation and merge rules.
- **Contact enrichment:** request an email or business phone when that field is needed.
- **AI product development:** ground responses in structured company and professional records.

The host owns decisions and downstream actions. TargetWise MCP does not send outreach or write to a CRM.

## Usage and result handling

Data calls are metered against the workspace allowance. Consult https://targetwise.ai/pricing for current plans and result charges. Do not automatically enrich every search candidate.

- Company and contact prospecting is bounded to 25 candidates per page and 10 pages; company identity search returns at most five candidates per page.
- Field availability varies. Handle `matched`, `partial` and `not_found` outcomes and preserve `unresolved_fields`.
- A returned phone is not necessarily a verified mobile number.
- Work-email lookup does not establish mailbox ownership or deliverability.
- Optional professional profile fields depend on account access and record availability.
- Retrieval timestamps describe when TargetWise made a request; source provenance is included only where available.

## Protocol

Use `Content-Type: application/json` and `Accept: application/json, text/event-stream`. The documented compatibility flow uses protocol version `2025-11-25`: initialize, send `notifications/initialized`, then list or call tools. Follow the live documentation for additional supported request modes.

The tools retrieve data, but calls can consume credits; consequently their annotations include `readOnlyHint: false` and `idempotentHint: false`.

## Service and licensing

The MIT license covers the Claude plugin and Desktop bridge, connection examples and documentation in this repository. Access to the hosted service and returned data is governed by TargetWise's plans and terms: https://targetwise.ai/legal/terms. The service and data are not licensed under MIT.

Privacy: https://targetwise.ai/legal/privacy  
Security: https://targetwise.ai/trust/security  
Support: https://targetwise.ai/company/contact

