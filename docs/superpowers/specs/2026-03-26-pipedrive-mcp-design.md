# Pipedrive MCP Server — Design Spec

## Overview

A custom MCP server for Artemis that provides read/write access to Pipedrive data. Deployed on Vercel as a Streamable HTTP endpoint, consumed by Claude Code. The MCP server is a **data layer only** — business rules and orchestration live in Claude Code with Artemis process documents.

## Architecture

```
┌─────────────────┐     Streamable HTTP      ┌──────────────────────┐
│   Claude Code    │ ◄──────────────────────► │   Vercel App (MCP)   │
│  (orchestrator)  │      (MCP protocol)      │                      │
│  + process docs  │                          │  - OAuth 2.0 flow    │
└─────────────────┘                          │  - Tool handlers     │
                                             │  - Pipedrive client  │
                                             │  - Response enricher │
                                             └──────────┬───────────┘
                                                        │
                                                        │ REST API
                                                        ▼
                                               ┌─────────────────┐
                                               │  Pipedrive API   │
                                               │  (v1 / v2)      │
                                               └─────────────────┘
```

### Key Layers

1. **MCP Transport** — Streamable HTTP endpoint handling MCP protocol (tool listing, tool execution). Each request is treated as stateless — user identity is resolved from the request headers, and OAuth tokens are loaded from Vercel KV per-request. No in-memory session state is maintained across serverless invocations.
2. **Auth** — OAuth 2.0 with Pipedrive. Each user authorizes once; tokens stored and refreshed server-side in Vercel KV. The MCP connection carries the user's identity.
3. **Tool Handlers** — MCP tools organized by resource. Enriched resource tools (Approach B) graduating to domain-oriented tools (Approach C) where it reduces round-trips.
4. **Pipedrive Client** — Typed TypeScript wrapper around the Pipedrive REST API. Handles pagination, rate limiting, error mapping. All tool handlers go through this layer.
5. **Response Enrichment** — Joins related data before returning to Claude Code. Happens in tool handlers by composing parallel Pipedrive client calls.

### What is NOT in the MCP server

- Business rules (lives in Claude Code process docs)
- Email/SMS sending (future, separate integrations)
- User management (OAuth handles identity)

## Authentication — OAuth 2.0

Pipedrive OAuth requires registering an app in the Pipedrive Developer Hub (client ID + secret).

### Flow

MCP connections are JSON-RPC over HTTP — there is no browser in the MCP channel. OAuth requires a browser-based consent step that happens outside the MCP connection:

1. **One-time setup (browser):** User visits `https://pipedrive-mcp.vercel.app/api/auth/authorize` in their browser. This redirects to Pipedrive's OAuth consent screen.
2. User authorizes the app. Pipedrive redirects to `/api/auth/callback` with an auth code.
3. Server exchanges the code for access + refresh tokens, stores them in Vercel KV (encrypted, keyed by Pipedrive user ID).
4. Callback page shows success and the user's Pipedrive user ID (used as their auth identifier).
5. **MCP connection:** User adds the server to their Claude Code config. Each MCP request includes the user's Pipedrive user ID (via a header or session token). The server looks up their stored OAuth tokens from KV.
6. On subsequent MCP requests, the server uses stored tokens, refreshing transparently as needed. If tokens are expired and cannot be refreshed, the tool returns an error directing the user to re-authorize via the browser URL.

### Token Storage

Vercel KV (Redis) — simple key-value, built into Vercel. Tokens encrypted at rest using a server-side encryption key. If the encryption key is lost/rotated, all stored tokens are invalidated and users must re-authorize — acceptable for a small team.

## MCP Tools — Initial Set (20 tools)

### Design Decisions

- **No delete operations.** Intentionally excluded from the initial build. Deleting deals, contacts, or activities is high-risk and rarely needed in the sales workflow. If needed, it can be done in the Pipedrive UI. Can be added later with confirmation safeguards.
- **Custom fields:** Pipedrive custom fields use hash-key names (e.g., `abc123_field_name`). The Pipedrive client will maintain a cached field mapping (fetched on first use, refreshed periodically) and translate hash keys to human-readable labels in all tool responses. Write tools accept human-readable field names and resolve them to hash keys.
- **Input schemas:** Every tool defines a JSON Schema for its inputs (required/optional fields, types) per the MCP protocol spec. This is defined in each tool's registration, not detailed in this design doc.

### Search

- **`search`** — Global search across deals, persons, and organizations using Pipedrive's `/v1/itemSearch` endpoint. Returns results grouped by type with basic enrichment (stage name for deals, org name for persons). Reduces the need for Claude Code to guess which `list-*` tool to call.

### Deals

- **`list-deals`** — List deals with filters (owner, stage, pipeline, status). Returns deals enriched with current stage name, person name, org name, and next activity date.
- **`get-deal`** — Single deal with full enrichment: activities, associated person, organization, stage info, custom fields, and notes.
- **`create-deal`** — Create a deal with optional associations (person, org, pipeline/stage).
- **`update-deal`** — Update deal fields (stage, status, custom fields, expected close date, etc).

### Activities

- **`list-activities`** — List activities with filters (deal, user, type, done/undone, date range). Enriched with deal title and contact name.
- **`create-activity`** — Schedule an activity on a deal (call, meeting, task, etc).
- **`update-activity`** — Update or mark an activity as done.

### Persons

- **`list-persons`** — Search/list contacts. Enriched with org name and open deal count.
- **`get-person`** — Full person detail with associated deals, activities, and org.
- **`create-person`** — Create a new contact.
- **`update-person`** — Update contact fields.

### Organizations

- **`list-organizations`** — Search/list orgs. Enriched with contact count and open deal count.
- **`get-organization`** — Full org detail with associated persons and deals.
- **`create-organization`** — Create a new organization.
- **`update-organization`** — Update organization fields.

### Pipelines & Stages

- **`list-pipelines`** — List all pipelines with their stages inline (no separate call needed).
- **`get-pipeline-deals`** — Deals in a pipeline, grouped by stage. Domain-oriented tool (Approach C) giving Claude Code a full pipeline view in one shot. Returns summary data per deal (title, value, person name, stage, next activity date) rather than full deal objects. Capped at 200 deals; accepts optional stage filter for larger pipelines.

### Notes

- **`list-notes`** — Notes for a deal, person, or org.
- **`create-note`** — Add a note.
- **`update-note`** — Edit a note.

## Pipedrive Client

### Responsibilities

- **Typed requests/responses** — TypeScript interfaces for each resource (Deal, Person, Activity, etc.).
- **Pagination** — All `list-*` tools accept optional `limit` (default 50, max 200) and `cursor` parameters. The client fetches one page per tool call — no auto-pagination to avoid Vercel function timeouts. Claude Code can request more pages by passing the returned cursor.
- **Rate limit handling** — For a 2-5 user team, Pipedrive rate limits are unlikely to be hit. Strategy is reactive: handle `429` responses with automatic retry + exponential backoff (up to 2 retries per request). No proactive token tracking needed at this scale.
- **Error mapping** — Translate Pipedrive HTTP errors into structured MCP error responses with three categories: `not_found` (404), `rate_limited` (429, include retry-after), `auth_expired` (401, include re-authorize URL), `validation_error` (400, include field-level details), `server_error` (5xx). Errors are returned as MCP tool error results with a `code` and `message`.
- **API version routing** — Some resources work better on v1 vs v2. Client abstracts this from tool handlers. Version mapping per resource will be determined during implementation based on Pipedrive API docs.

### Response Enrichment Pattern

Enrichment happens in tool handlers by composing client calls. Example for `get-deal`:

1. Fetch the deal
2. In parallel: fetch associated person, org, activities, notes
3. Resolve stage name from pipeline/stage IDs
4. Return a single merged response

No enrichment framework — just well-structured tool handlers. Shared patterns extracted as they emerge.

## Project Structure

```
/
├── src/
│   ├── server.ts              # MCP server setup, transport config
│   ├── auth/
│   │   ├── oauth.ts           # OAuth 2.0 flow (authorize, callback, refresh)
│   │   └── token-store.ts     # Vercel KV token persistence
│   ├── pipedrive/
│   │   ├── client.ts          # Typed Pipedrive API client
│   │   ├── types.ts           # TypeScript interfaces for Pipedrive resources
│   │   └── pagination.ts      # Pagination helpers
│   ├── tools/
│   │   ├── search.ts          # Global search tool
│   │   ├── deals.ts           # Deal tools (list, get, create, update)
│   │   ├── activities.ts      # Activity tools
│   │   ├── persons.ts         # Person tools
│   │   ├── organizations.ts   # Organization tools
│   │   ├── pipelines.ts       # Pipeline & stage tools
│   │   └── notes.ts           # Note tools
│   └── utils/
│       └── errors.ts          # Error mapping
├── api/
│   ├── mcp.ts                 # Vercel serverless entry point (MCP transport)
│   └── auth/
│       ├── authorize.ts       # Initiates OAuth flow
│       └── callback.ts        # Handles Pipedrive OAuth redirect
├── package.json
├── tsconfig.json
└── vercel.json
```

Separation: `pipedrive/` knows about the API, `tools/` knows about MCP, `auth/` handles identity. Each evolves independently.

## Deployment

### Vercel Configuration

- Single serverless function at `api/mcp.ts` for all MCP traffic (Streamable HTTP)
- OAuth routes at `api/auth/authorize.ts` and `api/auth/callback.ts`
- Vercel git integration: push to main = deploy
- **Vercel Pro plan assumed** — 60-second function timeout, sufficient for enriched responses making 4-5 parallel Pipedrive API calls including cold starts

### Environment Variables

| Variable | Source |
|---|---|
| `PIPEDRIVE_CLIENT_ID` | Pipedrive Developer Hub |
| `PIPEDRIVE_CLIENT_SECRET` | Pipedrive Developer Hub |
| `KV_REST_API_URL` | Auto-set when Vercel KV linked |
| `KV_REST_API_TOKEN` | Auto-set when Vercel KV linked |
| `ENCRYPTION_KEY` | Generated, for encrypting tokens at rest |

### User Connection

Users add to their Claude Code MCP config:

```json
{
  "mcpServers": {
    "pipedrive": {
      "type": "streamable-http",
      "url": "https://pipedrive-mcp.vercel.app/api/mcp"
    }
  }
}
```

User must authorize once via browser (visit `/api/auth/authorize`) before connecting from Claude Code. After that, it just works.

### Not in Scope (Yet)

- Custom domain
- CI/CD beyond Vercel git integration
- Monitoring beyond Vercel function logs
- Email/SMS sending (separate future integrations)
- Business logic / sales rules (lives in Claude Code process docs)

## Design Principles

1. **MCP = data layer.** Claude Code is the brain. The server delivers data fast and accurately.
2. **Enriched by default.** Minimize round-trips. If Claude Code commonly needs related data, bundle it.
3. **Extensible.** The architecture supports adding pre-computations, reports, and domain tools over time without restructuring.
4. **Small team, lean infra.** No over-engineering. Vercel KV for tokens, Vercel functions for compute, git push for deploys.
