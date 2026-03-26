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

1. **MCP Transport** — Streamable HTTP endpoint handling MCP protocol (session management, tool listing, tool execution).
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

1. User adds the MCP server to their Claude Code config with the Vercel URL.
2. On first connection, the MCP server redirects to Pipedrive's OAuth consent screen.
3. User authorizes, Pipedrive redirects back with an auth code.
4. Server exchanges code for access + refresh tokens.
5. Tokens are stored server-side in Vercel KV (encrypted, keyed by Pipedrive user ID).
6. On subsequent connections, the server uses stored tokens (refreshing as needed).

### Token Storage

Vercel KV (Redis) — simple key-value, built into Vercel. Tokens encrypted at rest using a server-side encryption key.

## MCP Tools — Initial Set (18 tools)

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
- **`get-pipeline-deals`** — All deals in a pipeline, grouped by stage. Domain-oriented tool (Approach C) giving Claude Code a full pipeline view in one shot.

### Notes

- **`list-notes`** — Notes for a deal, person, or org.
- **`create-note`** — Add a note.
- **`update-note`** — Edit a note.

## Pipedrive Client

### Responsibilities

- **Typed requests/responses** — TypeScript interfaces for each resource (Deal, Person, Activity, etc.).
- **Pagination** — Auto-paginate or expose cursor control. Pipedrive uses cursor-based pagination with max 500 items per page.
- **Rate limit handling** — Pipedrive assigns token costs per endpoint (1-20 tokens per request). Client tracks usage and backs off gracefully.
- **Error mapping** — Translate Pipedrive HTTP errors into clean MCP error responses.
- **API version routing** — Some resources work better on v1 vs v2. Client abstracts this from tool handlers.

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

First connection triggers OAuth. After that, it just works.

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
