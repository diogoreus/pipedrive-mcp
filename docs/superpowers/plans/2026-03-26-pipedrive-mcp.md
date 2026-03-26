# Pipedrive MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom Pipedrive MCP server for Artemis, deployed on Vercel, providing enriched read/write access to Pipedrive data via Streamable HTTP.

**Architecture:** Stateless Vercel serverless function exposing MCP tools via Streamable HTTP. OAuth 2.0 with Pipedrive for auth, tokens encrypted in Vercel KV. Typed Pipedrive client handles API calls; tool handlers compose client calls for enriched responses.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Zod v3, Vercel (serverless + KV), Pipedrive REST API (v1/v2), Vitest

**Spec:** `docs/superpowers/specs/2026-03-26-pipedrive-mcp-design.md`

---

## File Structure

```
/
├── src/
│   ├── server.ts              # McpServer instance with all tools registered
│   ├── auth/
│   │   ├── oauth.ts           # OAuth helpers (buildAuthorizeUrl, exchangeCode, refreshToken)
│   │   ├── token-store.ts     # Vercel KV encrypt/decrypt/store/retrieve tokens
│   │   └── encryption.ts      # AES-256-GCM encrypt/decrypt utilities
│   ├── pipedrive/
│   │   ├── client.ts          # Core HTTP client (fetch wrapper with auth, retry, error mapping)
│   │   ├── types.ts           # TypeScript interfaces for all Pipedrive resources
│   │   ├── fields.ts          # Custom field name→key mapping with TTL cache
│   │   └── pagination.ts      # Pagination types and cursor helpers
│   ├── tools/
│   │   ├── helpers.ts         # Shared ToolResult type, jsonResult, withErrorHandling wrapper
│   │   ├── search.ts          # Global search tool
│   │   ├── deals.ts           # Deal tools (list, get, create, update)
│   │   ├── activities.ts      # Activity tools (list, create, update)
│   │   ├── persons.ts         # Person tools (list, get, create, update)
│   │   ├── organizations.ts   # Organization tools (list, get, create, update)
│   │   ├── pipelines.ts       # Pipeline tools (list-pipelines, get-pipeline-deals)
│   │   └── notes.ts           # Note tools (list, create, update)
│   └── utils/
│       └── errors.ts          # Error types and Pipedrive→MCP error mapping
├── api/
│   ├── mcp.ts                 # Vercel entry point — stateless Streamable HTTP handler
│   └── auth/
│       ├── authorize.ts       # GET → redirect to Pipedrive OAuth consent
│       └── callback.ts        # GET → exchange code, store tokens, show success
├── tests/
│   ├── helpers/
│   │   └── mock-pipedrive.ts  # Shared mock factory for Pipedrive API responses
│   ├── auth/
│   │   ├── oauth.test.ts
│   │   ├── token-store.test.ts
│   │   └── encryption.test.ts
│   ├── pipedrive/
│   │   ├── client.test.ts
│   │   └── fields.test.ts
│   ├── tools/
│   │   ├── search.test.ts
│   │   ├── deals.test.ts
│   │   ├── activities.test.ts
│   │   ├── persons.test.ts
│   │   ├── organizations.test.ts
│   │   ├── pipelines.test.ts
│   │   └── notes.test.ts
│   └── utils/
│       └── errors.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vercel.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `vercel.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "pipedrive-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vercel dev",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@vercel/kv": "^3.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vercel": "^41.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "api/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "functions": {
    "api/mcp.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.vercel/
.env
.env.local
*.tsbuildinfo
```

- [ ] **Step 6: Create .env.example**

```
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
KV_REST_API_URL=
KV_REST_API_TOKEN=
ENCRYPTION_KEY=
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (no source files yet, clean exit)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts vercel.json .gitignore .env.example
git commit -m "feat: scaffold project with TypeScript, Vitest, Vercel config"
```

---

## Task 2: Error Handling Utilities

**Files:**
- Create: `src/utils/errors.ts`
- Create: `tests/utils/errors.test.ts`

- [ ] **Step 1: Write tests for error utilities**

```typescript
// tests/utils/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  PipedriveError,
  mapPipedriveError,
  toMcpError,
  ErrorCode,
} from "../../src/utils/errors.js";

describe("PipedriveError", () => {
  it("creates error with code and status", () => {
    const err = new PipedriveError("Not found", "not_found", 404);
    expect(err.message).toBe("Not found");
    expect(err.code).toBe("not_found");
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("mapPipedriveError", () => {
  it("maps 404 to not_found", () => {
    const err = mapPipedriveError(404, "Deal not found");
    expect(err.code).toBe("not_found");
    expect(err.statusCode).toBe(404);
  });

  it("maps 401 to auth_expired", () => {
    const err = mapPipedriveError(401, "Unauthorized");
    expect(err.code).toBe("auth_expired");
  });

  it("maps 429 to rate_limited with retryAfter", () => {
    const err = mapPipedriveError(429, "Too many requests", { retryAfter: 5 });
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(5);
  });

  it("maps 400 to validation_error", () => {
    const err = mapPipedriveError(400, "Invalid field");
    expect(err.code).toBe("validation_error");
  });

  it("maps 500 to server_error", () => {
    const err = mapPipedriveError(500, "Internal error");
    expect(err.code).toBe("server_error");
  });
});

describe("toMcpError", () => {
  it("formats PipedriveError as MCP tool error result", () => {
    const err = new PipedriveError("Deal not found", "not_found", 404);
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not_found");
    expect(result.content[0].text).toContain("Deal not found");
  });

  it("includes retryAfter for rate_limited errors", () => {
    const err = new PipedriveError("Rate limited", "rate_limited", 429);
    err.retryAfter = 10;
    const result = toMcpError(err);
    expect(result.content[0].text).toContain("10");
  });

  it("includes reauthorize URL for auth_expired errors", () => {
    const err = new PipedriveError("Token expired", "auth_expired", 401);
    const result = toMcpError(err);
    expect(result.content[0].text).toContain("/api/auth/authorize");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/utils/errors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement error utilities**

```typescript
// src/utils/errors.ts
export type ErrorCode =
  | "not_found"
  | "rate_limited"
  | "auth_expired"
  | "validation_error"
  | "server_error";

export class PipedriveError extends Error {
  code: ErrorCode;
  statusCode: number;
  retryAfter?: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, code: ErrorCode, statusCode: number) {
    super(message);
    this.name = "PipedriveError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function mapPipedriveError(
  status: number,
  message: string,
  options?: { retryAfter?: number; fieldErrors?: Record<string, string> }
): PipedriveError {
  let code: ErrorCode;
  if (status === 401) code = "auth_expired";
  else if (status === 404) code = "not_found";
  else if (status === 429) code = "rate_limited";
  else if (status >= 400 && status < 500) code = "validation_error";
  else code = "server_error";

  const err = new PipedriveError(message, code, status);
  if (options?.retryAfter) err.retryAfter = options.retryAfter;
  if (options?.fieldErrors) err.fieldErrors = options.fieldErrors;
  return err;
}

export function toMcpError(err: PipedriveError): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  let text = `Error [${err.code}]: ${err.message}`;

  if (err.code === "rate_limited" && err.retryAfter) {
    text += `\nRetry after ${err.retryAfter} seconds.`;
  }
  if (err.code === "auth_expired") {
    text += `\nPlease re-authorize at /api/auth/authorize`;
  }
  if (err.fieldErrors) {
    text += `\nField errors: ${JSON.stringify(err.fieldErrors)}`;
  }

  return {
    isError: true,
    content: [{ type: "text", text }],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/utils/errors.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/errors.ts tests/utils/errors.test.ts
git commit -m "feat: add error types and Pipedrive→MCP error mapping"
```

---

## Task 3: Encryption Utilities

**Files:**
- Create: `src/auth/encryption.ts`
- Create: `tests/auth/encryption.test.ts`

- [ ] **Step 1: Write tests for encryption**

```typescript
// tests/auth/encryption.test.ts
import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../../src/auth/encryption.js";

describe("encryption", () => {
  const key = "a".repeat(64); // 32 bytes hex-encoded

  it("encrypts and decrypts a string", () => {
    const plaintext = "my-secret-token";
    const encrypted = encrypt(plaintext, key);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted, key)).toBe(plaintext);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const plaintext = "same-input";
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with wrong key", () => {
    const encrypted = encrypt("secret", key);
    const wrongKey = "b".repeat(64);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it("handles empty string", () => {
    const encrypted = encrypt("", key);
    expect(decrypt(encrypted, key)).toBe("");
  });

  it("handles unicode", () => {
    const text = "hello 世界 🌍";
    const encrypted = encrypt(text, key);
    expect(decrypt(encrypted, key)).toBe(text);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth/encryption.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement encryption**

```typescript
// src/auth/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encrypt(plaintext: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all base64)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decrypt(encoded: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex");
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/encryption.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/encryption.ts tests/auth/encryption.test.ts
git commit -m "feat: add AES-256-GCM encryption utilities for token storage"
```

---

## Task 4: Token Store (Vercel KV)

**Files:**
- Create: `src/auth/token-store.ts`
- Create: `tests/auth/token-store.test.ts`

- [ ] **Step 1: Write tests for token store**

```typescript
// tests/auth/token-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenStore, type StoredTokens } from "../../src/auth/token-store.js";

// Mock @vercel/kv
vi.mock("@vercel/kv", () => {
  const store = new Map<string, string>();
  return {
    kv: {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    },
  };
});

describe("TokenStore", () => {
  const encryptionKey = "a".repeat(64);
  let tokenStore: TokenStore;

  beforeEach(() => {
    tokenStore = new TokenStore(encryptionKey);
  });

  it("stores and retrieves tokens", async () => {
    const tokens: StoredTokens = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Date.now() + 3600_000,
      apiDomain: "https://company.pipedrive.com",
    };

    await tokenStore.store("user-1", tokens);
    const retrieved = await tokenStore.retrieve("user-1");

    expect(retrieved).toEqual(tokens);
  });

  it("returns null for non-existent user", async () => {
    const result = await tokenStore.retrieve("nonexistent");
    expect(result).toBeNull();
  });

  it("encrypts tokens at rest (stored value is not plaintext)", async () => {
    const { kv } = await import("@vercel/kv");
    const tokens: StoredTokens = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Date.now() + 3600_000,
      apiDomain: "https://company.pipedrive.com",
    };

    await tokenStore.store("user-2", tokens);

    const setCall = vi.mocked(kv.set).mock.calls.find(
      (c) => c[0] === "tokens:user-2"
    );
    expect(setCall).toBeDefined();
    // The stored value should be encrypted, not contain the raw access token
    expect(String(setCall![1])).not.toContain("access-123");
  });

  it("deletes tokens", async () => {
    const tokens: StoredTokens = {
      accessToken: "access-123",
      refreshToken: "refresh-456",
      expiresAt: Date.now() + 3600_000,
      apiDomain: "https://company.pipedrive.com",
    };

    await tokenStore.store("user-3", tokens);
    await tokenStore.delete("user-3");
    const result = await tokenStore.retrieve("user-3");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth/token-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement token store**

```typescript
// src/auth/token-store.ts
import { kv } from "@vercel/kv";
import { encrypt, decrypt } from "./encryption.js";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
  apiDomain: string; // e.g. https://company.pipedrive.com
}

const KEY_PREFIX = "tokens:";

export class TokenStore {
  private encryptionKey: string;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  async store(userId: string, tokens: StoredTokens): Promise<void> {
    const plaintext = JSON.stringify(tokens);
    const encrypted = encrypt(plaintext, this.encryptionKey);
    await kv.set(`${KEY_PREFIX}${userId}`, encrypted);
  }

  async retrieve(userId: string): Promise<StoredTokens | null> {
    const encrypted = await kv.get<string>(`${KEY_PREFIX}${userId}`);
    if (!encrypted) return null;
    const plaintext = decrypt(encrypted, this.encryptionKey);
    return JSON.parse(plaintext) as StoredTokens;
  }

  async delete(userId: string): Promise<void> {
    await kv.del(`${KEY_PREFIX}${userId}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/token-store.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/token-store.ts tests/auth/token-store.test.ts
git commit -m "feat: add encrypted token store backed by Vercel KV"
```

---

## Task 5: OAuth Helpers

**Files:**
- Create: `src/auth/oauth.ts`
- Create: `tests/auth/oauth.test.ts`

- [ ] **Step 1: Write tests for OAuth helpers**

```typescript
// tests/auth/oauth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "../../src/auth/oauth.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("buildAuthorizeUrl", () => {
  it("builds correct Pipedrive OAuth URL", () => {
    const url = buildAuthorizeUrl({
      clientId: "my-client-id",
      redirectUri: "https://example.com/api/auth/callback",
      state: "abc123",
    });

    expect(url).toBe(
      "https://oauth.pipedrive.com/oauth/authorize?" +
        "client_id=my-client-id&" +
        "redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Fauth%2Fcallback&" +
        "state=abc123"
    );
  });
});

describe("exchangeCodeForTokens", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("exchanges auth code for tokens", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "access-123",
        refresh_token: "refresh-456",
        expires_in: 3599,
        api_domain: "https://company.pipedrive.com",
      }),
    });

    const result = await exchangeCodeForTokens({
      code: "auth-code",
      clientId: "client-id",
      clientSecret: "client-secret",
      redirectUri: "https://example.com/api/auth/callback",
    });

    expect(result.accessToken).toBe("access-123");
    expect(result.refreshToken).toBe("refresh-456");
    expect(result.apiDomain).toBe("https://company.pipedrive.com");
    expect(result.expiresAt).toBeGreaterThan(Date.now());

    // Verify correct request
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://oauth.pipedrive.com/oauth/token");
    expect(options.method).toBe("POST");
    expect(options.headers["Authorization"]).toMatch(/^Basic /);
  });

  it("throws on failed exchange", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "invalid_grant",
    });

    await expect(
      exchangeCodeForTokens({
        code: "bad-code",
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://example.com/api/auth/callback",
      })
    ).rejects.toThrow("OAuth token exchange failed");
  });
});

describe("refreshAccessToken", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("refreshes an expired token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 3599,
        api_domain: "https://company.pipedrive.com",
      }),
    });

    const result = await refreshAccessToken({
      refreshToken: "old-refresh",
      clientId: "client-id",
      clientSecret: "client-secret",
    });

    expect(result.accessToken).toBe("new-access");
    expect(result.refreshToken).toBe("new-refresh");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/auth/oauth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement OAuth helpers**

```typescript
// src/auth/oauth.ts
import type { StoredTokens } from "./token-store.js";

const OAUTH_BASE = "https://oauth.pipedrive.com/oauth";

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL(`${OAUTH_BASE}/authorize`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  if (params.state) url.searchParams.set("state", params.state);
  return url.toString();
}

function basicAuth(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeCodeForTokens(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(params.clientId, params.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    apiDomain: data.api_domain,
  };
}

export async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<StoredTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });

  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(params.clientId, params.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    apiDomain: data.api_domain,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/auth/oauth.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth/oauth.ts tests/auth/oauth.test.ts
git commit -m "feat: add OAuth helpers (authorize URL, token exchange, refresh)"
```

---

## Task 6: Pipedrive Types

**Files:**
- Create: `src/pipedrive/types.ts`
- Create: `src/pipedrive/pagination.ts`

No tests needed — these are pure type definitions.

- [ ] **Step 1: Create Pipedrive resource types**

```typescript
// src/pipedrive/types.ts

// --- Common ---

export interface PipedriveResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    next_cursor?: string;
    pagination?: { more_items_in_collection: boolean };
  };
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

// --- Deals ---

export interface Deal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: "open" | "won" | "lost" | "deleted";
  pipeline_id: number;
  stage_id: number;
  person_id: number | null;
  org_id: number | null;
  owner_id: number;
  expected_close_date: string | null;
  add_time: string;
  update_time: string;
  next_activity_date: string | null;
  next_activity_id: number | null;
  last_activity_date: string | null;
  won_time: string | null;
  lost_time: string | null;
  lost_reason: string | null;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown; // Custom field hash keys
}

export interface CreateDealParams {
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: "open" | "won" | "lost";
  expected_close_date?: string;
  owner_id?: number;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateDealParams {
  title?: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: "open" | "won" | "lost";
  expected_close_date?: string;
  owner_id?: number;
  custom_fields?: Record<string, unknown>;
}

// --- Activities ---

export interface Activity {
  id: number;
  subject: string;
  type: string;
  owner_id: number;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  due_date: string;
  due_time: string | null;
  duration: string | null;
  done: boolean;
  busy: boolean;
  note: string | null;
  location: string | null;
  add_time: string;
  update_time: string;
}

export interface CreateActivityParams {
  subject: string;
  type: string;
  due_date: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  owner_id?: number;
  done?: boolean;
  busy?: boolean;
  note?: string;
  location?: string;
}

export interface UpdateActivityParams {
  subject?: string;
  type?: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  done?: boolean;
  note?: string;
  location?: string;
}

// --- Persons ---

export interface Person {
  id: number;
  name: string;
  owner_id: number;
  org_id: number | null;
  emails: Array<{ value: string; primary: boolean; label: string }>;
  phones: Array<{ value: string; primary: boolean; label: string }>;
  add_time: string;
  update_time: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreatePersonParams {
  name: string;
  owner_id?: number;
  org_id?: number;
  emails?: Array<{ value: string; primary?: boolean; label?: string }>;
  phones?: Array<{ value: string; primary?: boolean; label?: string }>;
  custom_fields?: Record<string, unknown>;
}

export interface UpdatePersonParams {
  name?: string;
  owner_id?: number;
  org_id?: number;
  emails?: Array<{ value: string; primary?: boolean; label?: string }>;
  phones?: Array<{ value: string; primary?: boolean; label?: string }>;
  custom_fields?: Record<string, unknown>;
}

// --- Organizations ---

export interface Organization {
  id: number;
  name: string;
  owner_id: number;
  address: string | null;
  add_time: string;
  update_time: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateOrganizationParams {
  name: string;
  owner_id?: number;
  address?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateOrganizationParams {
  name?: string;
  owner_id?: number;
  address?: string;
  custom_fields?: Record<string, unknown>;
}

// --- Pipelines & Stages ---

export interface Pipeline {
  id: number;
  name: string;
  order_nr: number;
  is_deal_probability_enabled: boolean;
  add_time: string;
  update_time: string;
}

export interface Stage {
  id: number;
  name: string;
  pipeline_id: number;
  order_nr: number;
  deal_probability: number;
  add_time: string;
  update_time: string;
}

// --- Notes ---

export interface Note {
  id: number;
  content: string;
  user_id: number;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  add_time: string;
  update_time: string;
  pinned_to_deal_flag: boolean;
  pinned_to_person_flag: boolean;
  pinned_to_organization_flag: boolean;
}

export interface CreateNoteParams {
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
}

export interface UpdateNoteParams {
  content?: string;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
}

// --- Search ---

export interface SearchResult {
  result_score: number;
  item: {
    id: number;
    type: string;
    title: string;
    [key: string]: unknown;
  };
}

// --- Custom Fields ---

export interface DealField {
  id: number;
  key: string; // Hash key like "abc123_field_name"
  name: string; // Human-readable label
  field_type: string;
  options?: Array<{ id: number; label: string }>;
  is_custom_field: boolean;
}
```

- [ ] **Step 2: Create pagination helpers**

```typescript
// src/pipedrive/pagination.ts
export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export function clampLimit(limit: number | undefined): number {
  const val = limit ?? 50;
  return Math.min(Math.max(val, 1), 200);
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/pipedrive/types.ts src/pipedrive/pagination.ts
git commit -m "feat: add Pipedrive resource types and pagination helpers"
```

---

## Task 7: Pipedrive Client

**Files:**
- Create: `src/pipedrive/client.ts`
- Create: `tests/pipedrive/client.test.ts`
- Create: `tests/helpers/mock-pipedrive.ts`

- [ ] **Step 1: Create mock helpers**

```typescript
// tests/helpers/mock-pipedrive.ts
import { vi } from "vitest";
import type { PipedriveResponse } from "../../src/pipedrive/types.js";

export function mockFetchSuccess<T>(data: T, additionalData?: object) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      success: true,
      data,
      additional_data: additionalData,
    }),
  });
}

export function mockFetchError(status: number, message: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers(
      status === 429 ? { "Retry-After": "5" } : {}
    ),
    json: async () => ({ success: false, error: message }),
    text: async () => message,
  });
}

export function mockFetchSequence(
  responses: Array<{
    ok: boolean;
    status: number;
    data?: unknown;
    headers?: Record<string, string>;
    error?: string;
  }>
) {
  const fn = vi.fn();
  for (const res of responses) {
    fn.mockResolvedValueOnce({
      ok: res.ok,
      status: res.status,
      headers: new Headers(res.headers ?? {}),
      json: async () =>
        res.ok
          ? { success: true, data: res.data }
          : { success: false, error: res.error },
      text: async () => res.error ?? "",
    });
  }
  return fn;
}
```

- [ ] **Step 2: Write tests for Pipedrive client**

```typescript
// tests/pipedrive/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipedriveClient } from "../../src/pipedrive/client.js";
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchSequence,
} from "../helpers/mock-pipedrive.js";

describe("PipedriveClient", () => {
  let client: PipedriveClient;

  beforeEach(() => {
    client = new PipedriveClient({
      accessToken: "test-token",
      apiDomain: "https://company.pipedrive.com",
    });
  });

  describe("get", () => {
    it("makes authenticated GET request", async () => {
      const fetch = mockFetchSuccess({ id: 1, title: "Deal" });
      vi.stubGlobal("fetch", fetch);

      const result = await client.get("/api/v2/deals/1");

      expect(result).toEqual({ id: 1, title: "Deal" });
      const [url, options] = fetch.mock.calls[0];
      expect(url).toBe("https://company.pipedrive.com/api/v2/deals/1");
      expect(options.headers["Authorization"]).toBe("Bearer test-token");
    });

    it("appends query parameters", async () => {
      const fetch = mockFetchSuccess([]);
      vi.stubGlobal("fetch", fetch);

      await client.get("/api/v2/deals", { owner_id: "5", limit: "50" });

      const [url] = fetch.mock.calls[0];
      expect(url).toContain("owner_id=5");
      expect(url).toContain("limit=50");
    });
  });

  describe("post", () => {
    it("makes authenticated POST request with JSON body", async () => {
      const fetch = mockFetchSuccess({ id: 1, title: "New Deal" });
      vi.stubGlobal("fetch", fetch);

      const result = await client.post("/api/v2/deals", {
        title: "New Deal",
      });

      expect(result).toEqual({ id: 1, title: "New Deal" });
      const [, options] = fetch.mock.calls[0];
      expect(options.method).toBe("POST");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(options.body)).toEqual({ title: "New Deal" });
    });
  });

  describe("patch", () => {
    it("makes authenticated PATCH request", async () => {
      const fetch = mockFetchSuccess({ id: 1, title: "Updated" });
      vi.stubGlobal("fetch", fetch);

      const result = await client.patch("/api/v2/deals/1", {
        title: "Updated",
      });

      expect(result).toEqual({ id: 1, title: "Updated" });
      const [, options] = fetch.mock.calls[0];
      expect(options.method).toBe("PATCH");
    });
  });

  describe("put", () => {
    it("makes authenticated PUT request", async () => {
      const fetch = mockFetchSuccess({ id: 1, content: "Updated note" });
      vi.stubGlobal("fetch", fetch);

      const result = await client.put("/v1/notes/1", { content: "Updated note" });

      expect(result).toEqual({ id: 1, content: "Updated note" });
      const [, options] = fetch.mock.calls[0];
      expect(options.method).toBe("PUT");
    });
  });

  describe("getWithPagination", () => {
    it("returns data with next cursor", async () => {
      const fetch = mockFetchSuccess(
        [{ id: 1 }, { id: 2 }],
        { next_cursor: "abc123" }
      );
      vi.stubGlobal("fetch", fetch);

      const result = await client.getWithPagination("/api/v2/deals", {});

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBe("abc123");
    });

    it("returns undefined cursor when no more pages", async () => {
      const fetch = mockFetchSuccess([{ id: 1 }]);
      vi.stubGlobal("fetch", fetch);

      const result = await client.getWithPagination("/api/v2/deals", {});

      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("maps 404 to PipedriveError", async () => {
      vi.stubGlobal("fetch", mockFetchError(404, "Not found"));

      await expect(client.get("/api/v2/deals/999")).rejects.toMatchObject({
        code: "not_found",
        statusCode: 404,
      });
    });

    it("maps 401 to auth_expired", async () => {
      vi.stubGlobal("fetch", mockFetchError(401, "Unauthorized"));

      await expect(client.get("/api/v2/deals")).rejects.toMatchObject({
        code: "auth_expired",
      });
    });

    it("retries on 429 with backoff", async () => {
      const fetch = mockFetchSequence([
        { ok: false, status: 429, headers: { "Retry-After": "1" }, error: "Rate limited" },
        { ok: true, status: 200, data: { id: 1 } },
      ]);
      vi.stubGlobal("fetch", fetch);

      const result = await client.get("/api/v2/deals/1");

      expect(result).toEqual({ id: 1 });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("gives up after max retries on 429", async () => {
      const fetch = mockFetchSequence([
        { ok: false, status: 429, headers: { "Retry-After": "1" }, error: "Rate limited" },
        { ok: false, status: 429, headers: { "Retry-After": "1" }, error: "Rate limited" },
        { ok: false, status: 429, headers: { "Retry-After": "1" }, error: "Rate limited" },
      ]);
      vi.stubGlobal("fetch", fetch);

      await expect(client.get("/api/v2/deals/1")).rejects.toMatchObject({
        code: "rate_limited",
      });
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/pipedrive/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement Pipedrive client**

```typescript
// src/pipedrive/client.ts
import { PipedriveError, mapPipedriveError } from "../utils/errors.js";
import type { PipedriveResponse } from "./types.js";
import type { PaginatedResult } from "./pagination.js";

const MAX_RETRIES = 2;

export interface PipedriveClientConfig {
  accessToken: string;
  apiDomain: string; // e.g. https://company.pipedrive.com
}

export class PipedriveClient {
  private accessToken: string;
  private apiDomain: string;

  constructor(config: PipedriveClientConfig) {
    this.accessToken = config.accessToken;
    this.apiDomain = config.apiDomain;
  }

  async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: "GET" });
  }

  async getWithPagination<T>(
    path: string,
    params: Record<string, string>
  ): Promise<PaginatedResult<T>> {
    const url = this.buildUrl(path, params);
    return this.requestFull<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.apiDomain);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<T> {
    const res = await this.fetchWithRetry(url, init, retryCount);
    const json = (await res.json()) as PipedriveResponse<T>;
    return json.data;
  }

  private async requestFull<T>(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<PaginatedResult<T>> {
    const res = await this.fetchWithRetry(url, init, retryCount);
    const json = (await res.json()) as PipedriveResponse<T[]>;
    return {
      data: json.data,
      nextCursor: json.additional_data?.next_cursor,
      hasMore: !!json.additional_data?.next_cursor,
    };
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...((init.headers as Record<string, string>) ?? {}),
      },
    });

    if (res.ok) return res;

    // Retry on 429
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep(retryAfter * 1000);
      return this.fetchWithRetry(url, init, retryCount + 1);
    }

    // Map to PipedriveError
    let message: string;
    try {
      const json = await res.json();
      message = json.error ?? json.message ?? `HTTP ${res.status}`;
    } catch {
      message = await res.text().catch(() => `HTTP ${res.status}`);
    }

    const retryAfter = res.status === 429
      ? parseInt(res.headers.get("Retry-After") ?? "0", 10)
      : undefined;

    throw mapPipedriveError(res.status, message, { retryAfter });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/pipedrive/client.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/pipedrive/client.ts tests/pipedrive/client.test.ts tests/helpers/mock-pipedrive.ts
git commit -m "feat: add Pipedrive API client with auth, retry, and error mapping"
```

---

## Task 8: Custom Field Mapping

**Files:**
- Create: `src/pipedrive/fields.ts`
- Create: `tests/pipedrive/fields.test.ts`

- [ ] **Step 1: Write tests for field mapper**

```typescript
// tests/pipedrive/fields.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FieldMapper } from "../../src/pipedrive/fields.js";
import { mockFetchSuccess } from "../helpers/mock-pipedrive.js";

describe("FieldMapper", () => {
  let mapper: FieldMapper;

  beforeEach(() => {
    mapper = new FieldMapper();
    vi.stubGlobal(
      "fetch",
      mockFetchSuccess([
        { key: "title", name: "Title", field_type: "varchar", is_custom_field: false },
        { key: "abc123_custom", name: "Lead Source", field_type: "enum", is_custom_field: true },
        { key: "def456_custom", name: "Revenue Target", field_type: "monetary", is_custom_field: true },
      ])
    );
  });

  it("loads fields and maps key→name", async () => {
    await mapper.load({
      accessToken: "token",
      apiDomain: "https://company.pipedrive.com",
    });

    expect(mapper.keyToName("abc123_custom")).toBe("Lead Source");
    expect(mapper.keyToName("title")).toBe("Title");
  });

  it("maps name→key for custom fields", async () => {
    await mapper.load({
      accessToken: "token",
      apiDomain: "https://company.pipedrive.com",
    });

    expect(mapper.nameToKey("Lead Source")).toBe("abc123_custom");
    expect(mapper.nameToKey("Revenue Target")).toBe("def456_custom");
  });

  it("returns key as-is if not found", async () => {
    await mapper.load({
      accessToken: "token",
      apiDomain: "https://company.pipedrive.com",
    });

    expect(mapper.keyToName("unknown_key")).toBe("unknown_key");
    expect(mapper.nameToKey("Unknown Field")).toBe("Unknown Field");
  });

  it("translates custom fields in a deal response", async () => {
    await mapper.load({
      accessToken: "token",
      apiDomain: "https://company.pipedrive.com",
    });

    const deal = {
      id: 1,
      title: "Big Deal",
      abc123_custom: "Website",
      def456_custom: 50000,
    };

    const translated = mapper.translateResponse(deal);
    expect(translated["Lead Source"]).toBe("Website");
    expect(translated["Revenue Target"]).toBe(50000);
    expect(translated["abc123_custom"]).toBeUndefined();
  });

  it("resolves human-readable field names for write params", async () => {
    await mapper.load({
      accessToken: "token",
      apiDomain: "https://company.pipedrive.com",
    });

    const params = { "Lead Source": "Referral" };
    const resolved = mapper.resolveWriteFields(params);
    expect(resolved).toEqual({ abc123_custom: "Referral" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/pipedrive/fields.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement field mapper**

```typescript
// src/pipedrive/fields.ts
import type { DealField } from "./types.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export class FieldMapper {
  private keyToNameMap = new Map<string, string>();
  private nameToKeyMap = new Map<string, string>();
  private customKeys = new Set<string>();
  private loadedAt = 0;

  async load(config: { accessToken: string; apiDomain: string }): Promise<void> {
    if (Date.now() - this.loadedAt < CACHE_TTL_MS && this.keyToNameMap.size > 0) {
      return; // Cache still valid
    }

    const url = `${config.apiDomain}/api/v2/dealFields?limit=500`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to load deal fields: ${res.status}`);
    }

    const json = await res.json();
    const fields: DealField[] = json.data;

    // Build new maps, then swap atomically to avoid concurrent read issues
    const newKeyToName = new Map<string, string>();
    const newNameToKey = new Map<string, string>();
    const newCustomKeys = new Set<string>();

    for (const field of fields) {
      newKeyToName.set(field.key, field.name);
      newNameToKey.set(field.name, field.key);
      if (field.is_custom_field) {
        newCustomKeys.add(field.key);
      }
    }

    this.keyToNameMap = newKeyToName;
    this.nameToKeyMap = newNameToKey;
    this.customKeys = newCustomKeys;
    this.loadedAt = Date.now();
  }

  keyToName(key: string): string {
    return this.keyToNameMap.get(key) ?? key;
  }

  nameToKey(name: string): string {
    return this.nameToKeyMap.get(name) ?? name;
  }

  isCustomField(key: string): boolean {
    return this.customKeys.has(key);
  }

  translateResponse(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.customKeys.has(key)) {
        result[this.keyToName(key)] = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  resolveWriteFields(
    params: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(params)) {
      result[this.nameToKey(name)] = value;
    }
    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/pipedrive/fields.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/pipedrive/fields.ts tests/pipedrive/fields.test.ts
git commit -m "feat: add custom field name↔key mapper with TTL cache"
```

---

## Task 9: MCP Server Instance & Vercel Entry Point

**Files:**
- Create: `src/server.ts`
- Create: `api/mcp.ts`
- Create: `api/auth/authorize.ts`
- Create: `api/auth/callback.ts`

No unit tests for these — they are thin wiring. Tested via integration/manual testing.

- [ ] **Step 1: Create the MCP server instance**

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "pipedrive-mcp",
    version: "0.1.0",
  });

  // Tools are registered in subsequent tasks
  return server;
}
```

- [ ] **Step 2: Create the Vercel MCP entry point**

```typescript
// api/mcp.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept GET (SSE) and POST (JSON-RPC) for MCP
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const server = createServer();

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

- [ ] **Step 3: Create OAuth authorize endpoint**

```typescript
// api/auth/authorize.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildAuthorizeUrl } from "../../src/auth/oauth.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "PIPEDRIVE_CLIENT_ID not configured" });
    return;
  }

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  // Note: state parameter omitted — for internal tool with 2-5 users,
  // CSRF risk is minimal. Can add state validation via KV if needed.
  const url = buildAuthorizeUrl({ clientId, redirectUri });
  res.redirect(302, url);
}
```

- [ ] **Step 4: Create OAuth callback endpoint**

```typescript
// api/auth/callback.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exchangeCodeForTokens } from "../../src/auth/oauth.js";
import { TokenStore } from "../../src/auth/token-store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  const clientId = process.env.PIPEDRIVE_CLIENT_ID!;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET!;
  const encryptionKey = process.env.ENCRYPTION_KEY!;

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    // Get the user's Pipedrive ID to use as storage key
    const userRes = await fetch(`${tokens.apiDomain}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const userData = await userRes.json();
    const userId = String(userData.data.id);

    const tokenStore = new TokenStore(encryptionKey);
    await tokenStore.store(userId, tokens);

    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Connected to Pipedrive</h1>
          <p>Your Pipedrive user ID is: <strong>${userId}</strong></p>
          <p>Add this to your Claude Code MCP config headers to authenticate.</p>
          <p>You can close this page.</p>
        </body>
      </html>
    `);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/server.ts api/mcp.ts api/auth/authorize.ts api/auth/callback.ts
git commit -m "feat: add MCP server, Vercel entry point, and OAuth endpoints"
```

---

## Task 10: Shared Tool Helpers

**Files:**
- Create: `src/tools/helpers.ts`

No tests needed — pure utility types and a thin error wrapper.

- [ ] **Step 1: Create shared tool helpers**

```typescript
// src/tools/helpers.ts
import { PipedriveError, toMcpError } from "../utils/errors.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function withErrorHandling(
  handler: (...args: any[]) => Promise<ToolResult>
): (...args: any[]) => Promise<ToolResult> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof PipedriveError) return toMcpError(err);
      throw err;
    }
  };
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/tools/helpers.ts
git commit -m "feat: add shared tool helpers (jsonResult, withErrorHandling)"
```

---

## Task 11: Deal Tools

**Files:**
- Create: `src/tools/deals.ts`
- Create: `tests/tools/deals.test.ts`

- [ ] **Step 1: Write tests for deal tools**

```typescript
// tests/tools/deals.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDealTools } from "../../src/tools/deals.js";

// We test tool registration and handler logic by calling handlers directly.
// Mock the PipedriveClient and FieldMapper.

const mockClient = {
  get: vi.fn(),
  getWithPagination: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

const mockFieldMapper = {
  load: vi.fn(),
  translateResponse: vi.fn((obj: Record<string, unknown>) => obj),
  resolveWriteFields: vi.fn((obj: Record<string, unknown>) => obj),
};

// Import the handler functions directly for testing
import {
  handleListDeals,
  handleGetDeal,
  handleCreateDeal,
  handleUpdateDeal,
} from "../../src/tools/deals.js";

describe("handleListDeals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists deals with default pagination and returns cursor", async () => {
    mockClient.getWithPagination.mockResolvedValueOnce({
      data: [{ id: 1, title: "Deal A", stage_id: 1, person_id: 10, org_id: 20 }],
      nextCursor: "abc123",
      hasMore: true,
    });

    const result = await handleListDeals(
      { limit: 50 },
      mockClient as any,
      mockFieldMapper as any
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    const data = JSON.parse(result.content[0].text);
    expect(data.deals).toHaveLength(1);
    expect(data.deals[0].title).toBe("Deal A");
    expect(data.nextCursor).toBe("abc123");
  });

  it("passes filters to API", async () => {
    mockClient.getWithPagination.mockResolvedValueOnce({ data: [], nextCursor: undefined, hasMore: false });

    await handleListDeals(
      { owner_id: 5, status: "open", pipeline_id: 2 },
      mockClient as any,
      mockFieldMapper as any
    );

    const [, params] = mockClient.getWithPagination.mock.calls[0];
    expect(params.owner_id).toBe("5");
    expect(params.status).toBe("open");
    expect(params.pipeline_id).toBe("2");
  });
});

describe("handleGetDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enriched deal with activities, person, org", async () => {
    mockClient.get
      .mockResolvedValueOnce({ id: 1, title: "Big Deal", person_id: 10, org_id: 20, stage_id: 3, pipeline_id: 1 })
      .mockResolvedValueOnce([{ id: 100, subject: "Call" }]) // activities
      .mockResolvedValueOnce({ id: 10, name: "John" }) // person
      .mockResolvedValueOnce({ id: 20, name: "Acme Corp" }) // org
      .mockResolvedValueOnce([{ id: 1, content: "Note text" }]) // notes
      .mockResolvedValueOnce([{ id: 3, name: "Proposal", pipeline_id: 1 }]); // stages

    const result = await handleGetDeal(
      { id: 1 },
      mockClient as any,
      mockFieldMapper as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.deal.title).toBe("Big Deal");
    expect(data.person.name).toBe("John");
    expect(data.organization.name).toBe("Acme Corp");
    expect(data.activities).toHaveLength(1);
    expect(data.notes).toHaveLength(1);
    expect(data.stage_name).toBe("Proposal");
  });
});

describe("handleCreateDeal", () => {
  it("creates a deal and returns result", async () => {
    mockClient.post.mockResolvedValueOnce({ id: 99, title: "New Deal" });

    const result = await handleCreateDeal(
      { title: "New Deal", value: 10000 },
      mockClient as any,
      mockFieldMapper as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(99);
    expect(mockClient.post).toHaveBeenCalledWith(
      "/api/v2/deals",
      expect.objectContaining({ title: "New Deal", value: 10000 })
    );
  });
});

describe("handleUpdateDeal", () => {
  it("updates a deal and returns result", async () => {
    mockClient.patch.mockResolvedValueOnce({ id: 1, title: "Updated", status: "won" });

    const result = await handleUpdateDeal(
      { id: 1, status: "won" },
      mockClient as any,
      mockFieldMapper as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("won");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/deals.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement deal tools**

```typescript
// src/tools/deals.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Deal, Activity, Person, Organization, Note, Stage } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListDeals(
  inputs: {
    owner_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    limit?: number;
    cursor?: string;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = {
    limit: String(clampLimit(inputs.limit)),
  };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.pipeline_id) params.pipeline_id = String(inputs.pipeline_id);
  if (inputs.stage_id) params.stage_id = String(inputs.stage_id);
  if (inputs.status) params.status = inputs.status;
  if (inputs.cursor) params.cursor = inputs.cursor;

  const result = await client.getWithPagination<Deal>("/api/v2/deals", params);
  const translated = result.data.map((d) => fieldMapper.translateResponse(d as unknown as Record<string, unknown>));

  return jsonResult({ deals: translated, count: translated.length, nextCursor: result.nextCursor });
}

export async function handleGetDeal(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const deal = await client.get<Deal>(`/api/v2/deals/${inputs.id}`);

  // Fetch related data in parallel
  const [activities, person, org, notes, stages] = await Promise.all([
    client.get<Activity[]>("/api/v2/activities", { deal_id: String(inputs.id), limit: "50" }).catch(() => []),
    deal.person_id
      ? client.get<Person>(`/api/v2/persons/${deal.person_id}`).catch(() => null)
      : Promise.resolve(null),
    deal.org_id
      ? client.get<Organization>(`/api/v2/organizations/${deal.org_id}`).catch(() => null)
      : Promise.resolve(null),
    client.get<Note[]>("/api/v1/notes", { deal_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Stage[]>("/api/v2/stages", { pipeline_id: String(deal.pipeline_id) }).catch(() => []),
  ]);

  const stage = stages.find((s) => s.id === deal.stage_id);
  const translatedDeal = fieldMapper.translateResponse(deal as unknown as Record<string, unknown>);

  return jsonResult({
    deal: translatedDeal,
    stage_name: stage?.name ?? null,
    person,
    organization: org,
    activities,
    notes,
  });
}

export async function handleCreateDeal(
  inputs: {
    title: string;
    value?: number;
    currency?: string;
    person_id?: number;
    org_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    expected_close_date?: string;
    owner_id?: number;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields
    ? fieldMapper.resolveWriteFields(custom_fields)
    : {};

  const deal = await client.post<Deal>("/api/v2/deals", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });

  return jsonResult(deal);
}

export async function handleUpdateDeal(
  inputs: {
    id: number;
    title?: string;
    value?: number;
    currency?: string;
    person_id?: number;
    org_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    expected_close_date?: string;
    owner_id?: number;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields
    ? fieldMapper.resolveWriteFields(custom_fields)
    : {};

  const deal = await client.patch<Deal>(`/api/v2/deals/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });

  return jsonResult(deal);
}

export function registerDealTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-deals", {
    description: "List deals with filters (owner, stage, pipeline, status). Returns deal data with custom field names resolved. Use get-deal for full enrichment.",
    inputSchema: z.object({
      owner_id: z.number().optional().describe("Filter by deal owner user ID"),
      pipeline_id: z.number().optional().describe("Filter by pipeline ID"),
      stage_id: z.number().optional().describe("Filter by stage ID"),
      status: z.enum(["open", "won", "lost"]).optional().describe("Filter by deal status"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
    }),
  }, withErrorHandling(async (inputs) => handleListDeals(inputs, getClient(), getFieldMapper())));

  server.tool("get-deal", {
    description: "Get a single deal with full enrichment: activities, person, organization, stage info, custom fields, and notes.",
    inputSchema: z.object({
      id: z.number().describe("The deal ID"),
    }),
  }, withErrorHandling(async (inputs) => handleGetDeal(inputs, getClient(), getFieldMapper())));

  server.tool("create-deal", {
    description: "Create a new deal with optional associations.",
    inputSchema: z.object({
      title: z.string().describe("Deal title (required)"),
      value: z.number().optional().describe("Deal monetary value"),
      currency: z.string().optional().describe("Currency code (e.g., USD)"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      pipeline_id: z.number().optional().describe("Pipeline ID"),
      stage_id: z.number().optional().describe("Stage ID"),
      status: z.enum(["open", "won", "lost"]).optional().describe("Deal status"),
      expected_close_date: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (use human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateDeal(inputs, getClient(), getFieldMapper())));

  server.tool("update-deal", {
    description: "Update an existing deal's fields.",
    inputSchema: z.object({
      id: z.number().describe("The deal ID to update"),
      title: z.string().optional().describe("Deal title"),
      value: z.number().optional().describe("Deal monetary value"),
      currency: z.string().optional().describe("Currency code"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      pipeline_id: z.number().optional().describe("Pipeline ID"),
      stage_id: z.number().optional().describe("Stage ID"),
      status: z.enum(["open", "won", "lost"]).optional().describe("Deal status"),
      expected_close_date: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (use human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateDeal(inputs, getClient(), getFieldMapper())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/deals.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/deals.ts tests/tools/deals.test.ts
git commit -m "feat: add deal tools (list, get, create, update) with enrichment"
```

---

## Task 12: Activity Tools

**Files:**
- Create: `src/tools/activities.ts`
- Create: `tests/tools/activities.test.ts`

- [ ] **Step 1: Write tests for activity tools**

```typescript
// tests/tools/activities.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListActivities,
  handleCreateActivity,
  handleUpdateActivity,
} from "../../src/tools/activities.js";

const mockClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
};

describe("handleListActivities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists activities with filters", async () => {
    mockClient.get.mockResolvedValueOnce([
      { id: 1, subject: "Follow up call", deal_id: 5, done: false },
    ]);

    const result = await handleListActivities(
      { deal_id: 5, done: false },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.activities).toHaveLength(1);
    expect(data.activities[0].subject).toBe("Follow up call");

    const [, params] = mockClient.get.mock.calls[0];
    expect(params.deal_id).toBe("5");
    expect(params.done).toBe("0");
  });
});

describe("handleCreateActivity", () => {
  it("creates an activity", async () => {
    mockClient.post.mockResolvedValueOnce({
      id: 10,
      subject: "Call client",
      type: "call",
    });

    const result = await handleCreateActivity(
      { subject: "Call client", type: "call", due_date: "2026-04-01" },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(10);
  });
});

describe("handleUpdateActivity", () => {
  it("marks activity as done", async () => {
    mockClient.patch.mockResolvedValueOnce({
      id: 10,
      subject: "Call client",
      done: true,
    });

    const result = await handleUpdateActivity(
      { id: 10, done: true },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/activities.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement activity tools**

```typescript
// src/tools/activities.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Activity } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListActivities(
  inputs: {
    deal_id?: number;
    owner_id?: number;
    type?: string;
    done?: boolean;
    due_date_from?: string;
    due_date_to?: string;
    limit?: number;
    cursor?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = {
    limit: String(clampLimit(inputs.limit)),
  };
  if (inputs.deal_id) params.deal_id = String(inputs.deal_id);
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.type) params.type = inputs.type;
  if (inputs.done !== undefined) params.done = inputs.done ? "1" : "0";
  if (inputs.due_date_from) params.updated_since = inputs.due_date_from;
  if (inputs.due_date_to) params.updated_until = inputs.due_date_to;
  if (inputs.cursor) params.cursor = inputs.cursor;

  const activities = await client.get<Activity[]>("/api/v2/activities", params);
  return jsonResult({ activities, count: activities.length });
}

export async function handleCreateActivity(
  inputs: {
    subject: string;
    type: string;
    due_date: string;
    due_time?: string;
    duration?: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    owner_id?: number;
    done?: boolean;
    busy?: boolean;
    note?: string;
    location?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const activity = await client.post<Activity>("/api/v2/activities", inputs);
  return jsonResult(activity);
}

export async function handleUpdateActivity(
  inputs: {
    id: number;
    subject?: string;
    type?: string;
    due_date?: string;
    due_time?: string;
    duration?: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    done?: boolean;
    note?: string;
    location?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const { id, ...rest } = inputs;
  const activity = await client.patch<Activity>(`/api/v2/activities/${id}`, rest);
  return jsonResult(activity);
}

export function registerActivityTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-activities", {
    description: "List activities with filters (deal, user, type, done/undone, date range).",
    inputSchema: z.object({
      deal_id: z.number().optional().describe("Filter by deal ID"),
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      type: z.string().optional().describe("Filter by activity type (call, meeting, task, etc.)"),
      done: z.boolean().optional().describe("Filter by completion status"),
      due_date_from: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
      due_date_to: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListActivities(inputs, getClient())));

  server.tool("create-activity", {
    description: "Schedule a new activity (call, meeting, task, etc.) on a deal.",
    inputSchema: z.object({
      subject: z.string().describe("Activity subject/title"),
      type: z.string().describe("Activity type (call, meeting, task, deadline, email, lunch)"),
      due_date: z.string().describe("Due date (YYYY-MM-DD)"),
      due_time: z.string().optional().describe("Due time (HH:MM)"),
      duration: z.string().optional().describe("Duration (HH:MM)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      owner_id: z.number().optional().describe("Assigned owner user ID"),
      done: z.boolean().optional().describe("Whether already completed"),
      busy: z.boolean().optional().describe("Whether marked as busy"),
      note: z.string().optional().describe("Activity note/description"),
      location: z.string().optional().describe("Location"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateActivity(inputs, getClient())));

  server.tool("update-activity", {
    description: "Update an existing activity or mark it as done.",
    inputSchema: z.object({
      id: z.number().describe("Activity ID to update"),
      subject: z.string().optional().describe("Activity subject"),
      type: z.string().optional().describe("Activity type"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      due_time: z.string().optional().describe("Due time (HH:MM)"),
      duration: z.string().optional().describe("Duration (HH:MM)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      done: z.boolean().optional().describe("Mark as done/undone"),
      note: z.string().optional().describe("Activity note"),
      location: z.string().optional().describe("Location"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateActivity(inputs, getClient())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/activities.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/activities.ts tests/tools/activities.test.ts
git commit -m "feat: add activity tools (list, create, update)"
```

---

## Task 13: Person Tools

**Files:**
- Create: `src/tools/persons.ts`
- Create: `tests/tools/persons.test.ts`

Follows the same pattern as deals. Tests cover list, get (with enrichment), create, update.

- [ ] **Step 1: Write tests for person tools**

```typescript
// tests/tools/persons.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListPersons,
  handleGetPerson,
  handleCreatePerson,
  handleUpdatePerson,
} from "../../src/tools/persons.js";

const mockClient = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
const mockFieldMapper = {
  load: vi.fn(),
  translateResponse: vi.fn((o: Record<string, unknown>) => o),
  resolveWriteFields: vi.fn((o: Record<string, unknown>) => o),
};

describe("handleListPersons", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns persons list", async () => {
    mockClient.get.mockResolvedValueOnce([
      { id: 1, name: "John Doe", org_id: 5 },
    ]);

    const result = await handleListPersons({}, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.persons).toHaveLength(1);
  });
});

describe("handleGetPerson", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns enriched person with deals, activities, org", async () => {
    mockClient.get
      .mockResolvedValueOnce({ id: 1, name: "John", org_id: 5 }) // person
      .mockResolvedValueOnce([{ id: 10, title: "Deal A" }]) // deals
      .mockResolvedValueOnce([{ id: 20, subject: "Call" }]) // activities
      .mockResolvedValueOnce({ id: 5, name: "Acme Corp" }); // org

    const result = await handleGetPerson({ id: 1 }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.person.name).toBe("John");
    expect(data.deals).toHaveLength(1);
    expect(data.activities).toHaveLength(1);
    expect(data.organization.name).toBe("Acme Corp");
  });
});

describe("handleCreatePerson", () => {
  it("creates a person", async () => {
    mockClient.post.mockResolvedValueOnce({ id: 50, name: "Jane" });
    const result = await handleCreatePerson({ name: "Jane" }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(50);
  });
});

describe("handleUpdatePerson", () => {
  it("updates a person", async () => {
    mockClient.patch.mockResolvedValueOnce({ id: 1, name: "John Updated" });
    const result = await handleUpdatePerson({ id: 1, name: "John Updated" }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("John Updated");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/persons.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement person tools**

```typescript
// src/tools/persons.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Person, Deal, Activity, Organization } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListPersons(
  inputs: { owner_id?: number; org_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.org_id) params.org_id = String(inputs.org_id);
  if (inputs.cursor) params.cursor = inputs.cursor;

  const persons = await client.get<Person[]>("/api/v2/persons", params);
  const translated = persons.map((p) => fieldMapper.translateResponse(p as unknown as Record<string, unknown>));
  return jsonResult({ persons: translated, count: translated.length });
}

export async function handleGetPerson(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const person = await client.get<Person>(`/api/v2/persons/${inputs.id}`);

  const [deals, activities, org] = await Promise.all([
    client.get<Deal[]>("/api/v2/deals", { person_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Activity[]>("/api/v2/activities", { person_id: String(inputs.id), limit: "50" }).catch(() => []),
    person.org_id
      ? client.get<Organization>(`/api/v2/organizations/${person.org_id}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const translatedPerson = fieldMapper.translateResponse(person as unknown as Record<string, unknown>);
  return jsonResult({ person: translatedPerson, deals, activities, organization: org });
}

export async function handleCreatePerson(
  inputs: {
    name: string;
    owner_id?: number;
    org_id?: number;
    emails?: Array<{ value: string; primary?: boolean; label?: string }>;
    phones?: Array<{ value: string; primary?: boolean; label?: string }>;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const person = await client.post<Person>("/api/v2/persons", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(person);
}

export async function handleUpdatePerson(
  inputs: {
    id: number;
    name?: string;
    owner_id?: number;
    org_id?: number;
    emails?: Array<{ value: string; primary?: boolean; label?: string }>;
    phones?: Array<{ value: string; primary?: boolean; label?: string }>;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const person = await client.patch<Person>(`/api/v2/persons/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(person);
}

export function registerPersonTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-persons", {
    description: "List contacts with filters (owner, org). Custom field names resolved.",
    inputSchema: z.object({
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      org_id: z.number().optional().describe("Filter by organization ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListPersons(inputs, getClient(), getFieldMapper())));

  server.tool("get-person", {
    description: "Get full person detail with associated deals, activities, and organization.",
    inputSchema: z.object({
      id: z.number().describe("Person ID"),
    }),
  }, withErrorHandling(async (inputs) => handleGetPerson(inputs, getClient(), getFieldMapper())));

  server.tool("create-person", {
    description: "Create a new contact.",
    inputSchema: z.object({
      name: z.string().describe("Person name (required)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      org_id: z.number().optional().describe("Organization ID"),
      emails: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Email addresses"),
      phones: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Phone numbers"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleCreatePerson(inputs, getClient(), getFieldMapper())));

  server.tool("update-person", {
    description: "Update a contact's fields.",
    inputSchema: z.object({
      id: z.number().describe("Person ID to update"),
      name: z.string().optional().describe("Person name"),
      owner_id: z.number().optional().describe("Owner user ID"),
      org_id: z.number().optional().describe("Organization ID"),
      emails: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Email addresses"),
      phones: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Phone numbers"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdatePerson(inputs, getClient(), getFieldMapper())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/persons.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/persons.ts tests/tools/persons.test.ts
git commit -m "feat: add person tools (list, get, create, update) with enrichment"
```

---

## Task 14: Organization Tools

**Files:**
- Create: `src/tools/organizations.ts`
- Create: `tests/tools/organizations.test.ts`

Same pattern as persons. Enrichment for `get-organization` includes associated persons and deals.

- [ ] **Step 1: Write tests for organization tools**

```typescript
// tests/tools/organizations.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListOrganizations,
  handleGetOrganization,
  handleCreateOrganization,
  handleUpdateOrganization,
} from "../../src/tools/organizations.js";

const mockClient = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
const mockFieldMapper = {
  load: vi.fn(),
  translateResponse: vi.fn((o: Record<string, unknown>) => o),
  resolveWriteFields: vi.fn((o: Record<string, unknown>) => o),
};

describe("handleListOrganizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns organization list", async () => {
    mockClient.get.mockResolvedValueOnce([{ id: 1, name: "Acme Corp" }]);
    const result = await handleListOrganizations({}, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.organizations).toHaveLength(1);
  });
});

describe("handleGetOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns enriched org with persons and deals", async () => {
    mockClient.get
      .mockResolvedValueOnce({ id: 1, name: "Acme Corp" })
      .mockResolvedValueOnce([{ id: 10, name: "John" }]) // persons
      .mockResolvedValueOnce([{ id: 20, title: "Deal A" }]); // deals

    const result = await handleGetOrganization({ id: 1 }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.organization.name).toBe("Acme Corp");
    expect(data.persons).toHaveLength(1);
    expect(data.deals).toHaveLength(1);
  });
});

describe("handleCreateOrganization", () => {
  it("creates an organization", async () => {
    mockClient.post.mockResolvedValueOnce({ id: 99, name: "New Corp" });
    const result = await handleCreateOrganization({ name: "New Corp" }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(99);
  });
});

describe("handleUpdateOrganization", () => {
  it("updates an organization", async () => {
    mockClient.patch.mockResolvedValueOnce({ id: 1, name: "Acme Updated" });
    const result = await handleUpdateOrganization({ id: 1, name: "Acme Updated" }, mockClient as any, mockFieldMapper as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Acme Updated");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/organizations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement organization tools**

```typescript
// src/tools/organizations.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Organization, Person, Deal } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListOrganizations(
  inputs: { owner_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.cursor) params.cursor = inputs.cursor;

  const orgs = await client.get<Organization[]>("/api/v2/organizations", params);
  const translated = orgs.map((o) => fieldMapper.translateResponse(o as unknown as Record<string, unknown>));
  return jsonResult({ organizations: translated, count: translated.length });
}

export async function handleGetOrganization(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const org = await client.get<Organization>(`/api/v2/organizations/${inputs.id}`);

  const [persons, deals] = await Promise.all([
    client.get<Person[]>("/api/v2/persons", { org_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Deal[]>("/api/v2/deals", { org_id: String(inputs.id), limit: "50" }).catch(() => []),
  ]);

  const translatedOrg = fieldMapper.translateResponse(org as unknown as Record<string, unknown>);
  return jsonResult({ organization: translatedOrg, persons, deals });
}

export async function handleCreateOrganization(
  inputs: { name: string; owner_id?: number; address?: string; custom_fields?: Record<string, unknown> },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const org = await client.post<Organization>("/api/v2/organizations", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(org);
}

export async function handleUpdateOrganization(
  inputs: { id: number; name?: string; owner_id?: number; address?: string; custom_fields?: Record<string, unknown> },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const org = await client.patch<Organization>(`/api/v2/organizations/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(org);
}

export function registerOrganizationTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-organizations", {
    description: "List organizations with filters (owner). Custom field names resolved.",
    inputSchema: z.object({
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListOrganizations(inputs, getClient(), getFieldMapper())));

  server.tool("get-organization", {
    description: "Get full organization detail with associated persons and deals.",
    inputSchema: z.object({
      id: z.number().describe("Organization ID"),
    }),
  }, withErrorHandling(async (inputs) => handleGetOrganization(inputs, getClient(), getFieldMapper())));

  server.tool("create-organization", {
    description: "Create a new organization.",
    inputSchema: z.object({
      name: z.string().describe("Organization name (required)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      address: z.string().optional().describe("Address"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateOrganization(inputs, getClient(), getFieldMapper())));

  server.tool("update-organization", {
    description: "Update an organization's fields.",
    inputSchema: z.object({
      id: z.number().describe("Organization ID to update"),
      name: z.string().optional().describe("Organization name"),
      owner_id: z.number().optional().describe("Owner user ID"),
      address: z.string().optional().describe("Address"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateOrganization(inputs, getClient(), getFieldMapper())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/organizations.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/organizations.ts tests/tools/organizations.test.ts
git commit -m "feat: add organization tools (list, get, create, update) with enrichment"
```

---

## Task 15: Pipeline Tools

**Files:**
- Create: `src/tools/pipelines.ts`
- Create: `tests/tools/pipelines.test.ts`

- [ ] **Step 1: Write tests for pipeline tools**

```typescript
// tests/tools/pipelines.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListPipelines,
  handleGetPipelineDeals,
} from "../../src/tools/pipelines.js";

const mockClient = { get: vi.fn() };

describe("handleListPipelines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns pipelines with stages inline", async () => {
    mockClient.get
      .mockResolvedValueOnce([
        { id: 1, name: "Sales" },
        { id: 2, name: "Enterprise" },
      ]) // pipelines
      .mockResolvedValueOnce([
        { id: 10, name: "Lead", pipeline_id: 1, order_nr: 1 },
        { id: 11, name: "Proposal", pipeline_id: 1, order_nr: 2 },
        { id: 20, name: "Discovery", pipeline_id: 2, order_nr: 1 },
      ]); // all stages

    const result = await handleListPipelines(mockClient as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.pipelines).toHaveLength(2);
    expect(data.pipelines[0].stages).toHaveLength(2);
    expect(data.pipelines[1].stages).toHaveLength(1);
  });
});

describe("handleGetPipelineDeals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns deals grouped by stage", async () => {
    mockClient.get
      .mockResolvedValueOnce([
        { id: 10, name: "Lead", pipeline_id: 1, order_nr: 1 },
        { id: 11, name: "Proposal", pipeline_id: 1, order_nr: 2 },
      ]) // stages
      .mockResolvedValueOnce([
        { id: 1, title: "Deal A", stage_id: 10, value: 5000, person_id: null, next_activity_date: null },
        { id: 2, title: "Deal B", stage_id: 11, value: 10000, person_id: null, next_activity_date: "2026-04-01" },
      ]); // deals

    const result = await handleGetPipelineDeals(
      { pipeline_id: 1 },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.stages).toHaveLength(2);
    expect(data.stages[0].name).toBe("Lead");
    expect(data.stages[0].deals).toHaveLength(1);
    expect(data.stages[1].name).toBe("Proposal");
    expect(data.stages[1].deals).toHaveLength(1);
  });

  it("caps at 200 deals", async () => {
    mockClient.get
      .mockResolvedValueOnce([{ id: 10, name: "Lead", pipeline_id: 1, order_nr: 1 }])
      .mockResolvedValueOnce([]); // deals

    await handleGetPipelineDeals({ pipeline_id: 1 }, mockClient as any);

    const [, params] = mockClient.get.mock.calls[1];
    expect(params.limit).toBe("200");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/pipelines.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pipeline tools**

```typescript
// src/tools/pipelines.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Pipeline, Stage, Deal } from "../pipedrive/types.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListPipelines(
  client: PipedriveClient
): Promise<ToolResult> {
  const [pipelines, stages] = await Promise.all([
    client.get<Pipeline[]>("/api/v2/pipelines", { limit: "500" }),
    client.get<Stage[]>("/api/v2/stages", { limit: "500" }),
  ]);

  const stagesByPipeline = new Map<number, Stage[]>();
  for (const stage of stages) {
    const existing = stagesByPipeline.get(stage.pipeline_id) ?? [];
    existing.push(stage);
    stagesByPipeline.set(stage.pipeline_id, existing);
  }

  const enriched = pipelines.map((p) => ({
    ...p,
    stages: (stagesByPipeline.get(p.id) ?? []).sort(
      (a, b) => a.order_nr - b.order_nr
    ),
  }));

  return jsonResult({ pipelines: enriched });
}

export async function handleGetPipelineDeals(
  inputs: { pipeline_id: number; stage_id?: number },
  client: PipedriveClient
): Promise<ToolResult> {
  const stageParams: Record<string, string> = {
    pipeline_id: String(inputs.pipeline_id),
    limit: "500",
  };
  const dealParams: Record<string, string> = {
    pipeline_id: String(inputs.pipeline_id),
    status: "open",
    limit: "200",
  };
  if (inputs.stage_id) dealParams.stage_id = String(inputs.stage_id);

  const [stages, deals] = await Promise.all([
    client.get<Stage[]>("/api/v2/stages", stageParams),
    client.get<Deal[]>("/api/v2/deals", dealParams),
  ]);

  const sortedStages = stages.sort((a, b) => a.order_nr - b.order_nr);

  const dealsByStage = new Map<number, Array<{
    id: number;
    title: string;
    value: number;
    person_id: number | null;
    next_activity_date: string | null;
  }>>();

  for (const deal of deals) {
    const summary = {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      person_id: deal.person_id,
      next_activity_date: deal.next_activity_date,
    };
    const existing = dealsByStage.get(deal.stage_id) ?? [];
    existing.push(summary);
    dealsByStage.set(deal.stage_id, existing);
  }

  const result = sortedStages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    order_nr: stage.order_nr,
    deals: dealsByStage.get(stage.id) ?? [],
    deal_count: (dealsByStage.get(stage.id) ?? []).length,
  }));

  return jsonResult({
    pipeline_id: inputs.pipeline_id,
    total_deals: deals.length,
    stages: result,
  });
}

export function registerPipelineTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-pipelines", {
    description: "List all pipelines with their stages inline.",
    inputSchema: z.object({}),
  }, withErrorHandling(async () => handleListPipelines(getClient())));

  server.tool("get-pipeline-deals", {
    description: "Get all deals in a pipeline grouped by stage. Returns summary data per deal (title, value, next activity date). Capped at 200 deals.",
    inputSchema: z.object({
      pipeline_id: z.number().describe("Pipeline ID"),
      stage_id: z.number().optional().describe("Optional: filter to a specific stage"),
    }),
  }, withErrorHandling(async (inputs) => handleGetPipelineDeals(inputs, getClient())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/pipelines.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/pipelines.ts tests/tools/pipelines.test.ts
git commit -m "feat: add pipeline tools (list with stages, get deals by stage)"
```

---

## Task 16: Note Tools

**Files:**
- Create: `src/tools/notes.ts`
- Create: `tests/tools/notes.test.ts`

- [ ] **Step 1: Write tests for note tools**

```typescript
// tests/tools/notes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleListNotes,
  handleCreateNote,
  handleUpdateNote,
} from "../../src/tools/notes.js";

const mockClient = { get: vi.fn(), post: vi.fn(), put: vi.fn() };

describe("handleListNotes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists notes for a deal", async () => {
    mockClient.get.mockResolvedValueOnce([
      { id: 1, content: "<p>Note text</p>", deal_id: 5 },
    ]);

    const result = await handleListNotes({ deal_id: 5 }, mockClient as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.notes).toHaveLength(1);
  });
});

describe("handleCreateNote", () => {
  it("creates a note", async () => {
    mockClient.post.mockResolvedValueOnce({
      id: 10,
      content: "<p>New note</p>",
    });

    const result = await handleCreateNote(
      { content: "New note", deal_id: 5 },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe(10);
  });
});

describe("handleUpdateNote", () => {
  it("updates a note", async () => {
    mockClient.put.mockResolvedValueOnce({
      id: 10,
      content: "<p>Updated</p>",
    });

    const result = await handleUpdateNote(
      { id: 10, content: "Updated" },
      mockClient as any
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.content).toBe("<p>Updated</p>");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/notes.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement note tools**

Notes use the v1 API (PUT for updates instead of PATCH).

```typescript
// src/tools/notes.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Note } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListNotes(
  inputs: { deal_id?: number; person_id?: number; org_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.deal_id) params.deal_id = String(inputs.deal_id);
  if (inputs.person_id) params.person_id = String(inputs.person_id);
  if (inputs.org_id) params.org_id = String(inputs.org_id);
  if (inputs.cursor) params.start = inputs.cursor; // v1 uses start/limit pagination

  const notes = await client.get<Note[]>("/api/v1/notes", params);
  return jsonResult({ notes, count: notes.length });
}

export async function handleCreateNote(
  inputs: {
    content: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    pinned_to_deal_flag?: boolean;
    pinned_to_person_flag?: boolean;
    pinned_to_organization_flag?: boolean;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const note = await client.post<Note>("/api/v1/notes", inputs);
  return jsonResult(note);
}

export async function handleUpdateNote(
  inputs: {
    id: number;
    content?: string;
    pinned_to_deal_flag?: boolean;
    pinned_to_person_flag?: boolean;
    pinned_to_organization_flag?: boolean;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const { id, ...rest } = inputs;
  const note = await client.put<Note>(`/v1/notes/${id}`, rest);
  return jsonResult(note);
}

export function registerNoteTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-notes", {
    description: "List notes for a deal, person, or organization.",
    inputSchema: z.object({
      deal_id: z.number().optional().describe("Filter by deal ID"),
      person_id: z.number().optional().describe("Filter by person ID"),
      org_id: z.number().optional().describe("Filter by organization ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListNotes(inputs, getClient())));

  server.tool("create-note", {
    description: "Add a note to a deal, person, or organization.",
    inputSchema: z.object({
      content: z.string().describe("Note content (HTML supported)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      pinned_to_deal_flag: z.boolean().optional().describe("Pin to deal"),
      pinned_to_person_flag: z.boolean().optional().describe("Pin to person"),
      pinned_to_organization_flag: z.boolean().optional().describe("Pin to organization"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateNote(inputs, getClient())));

  server.tool("update-note", {
    description: "Edit an existing note.",
    inputSchema: z.object({
      id: z.number().describe("Note ID to update"),
      content: z.string().optional().describe("Updated content (HTML supported)"),
      pinned_to_deal_flag: z.boolean().optional().describe("Pin to deal"),
      pinned_to_person_flag: z.boolean().optional().describe("Pin to person"),
      pinned_to_organization_flag: z.boolean().optional().describe("Pin to organization"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateNote(inputs, getClient())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/notes.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/notes.ts tests/tools/notes.test.ts
git commit -m "feat: add note tools (list, create, update) using v1 API"
```

---

## Task 17: Search Tool

**Files:**
- Create: `src/tools/search.ts`
- Create: `tests/tools/search.test.ts`

- [ ] **Step 1: Write tests for search tool**

```typescript
// tests/tools/search.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSearch } from "../../src/tools/search.js";

const mockClient = { get: vi.fn() };

describe("handleSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("searches and returns grouped results", async () => {
    mockClient.get.mockResolvedValueOnce({
      items: [
        { result_score: 0.9, item: { id: 1, type: "deal", title: "Big Deal" } },
        { result_score: 0.8, item: { id: 2, type: "person", title: "John Doe" } },
      ],
    });

    const result = await handleSearch({ term: "big" }, mockClient as any);
    const data = JSON.parse(result.content[0].text);
    expect(data.results).toHaveLength(2);
  });

  it("passes item_types filter", async () => {
    mockClient.get.mockResolvedValueOnce({ items: [] });

    await handleSearch(
      { term: "acme", item_types: ["organization", "person"] },
      mockClient as any
    );

    const [, params] = mockClient.get.mock.calls[0];
    expect(params.item_types).toBe("organization,person");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tools/search.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement search tool**

```typescript
// src/tools/search.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { SearchResult } from "../pipedrive/types.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleSearch(
  inputs: {
    term: string;
    item_types?: string[];
    limit?: number;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = {
    term: inputs.term,
    limit: String(Math.min(inputs.limit ?? 20, 100)),
  };
  if (inputs.item_types?.length) {
    params.item_types = inputs.item_types.join(",");
  }

  const data = await client.get<{ items: SearchResult[] }>(
    "/api/v1/itemSearch",
    params
  );

  return jsonResult({ results: data.items, count: data.items.length });
}

export function registerSearchTool(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("search", {
    description: "Global search across deals, persons, and organizations. Returns results grouped by type.",
    inputSchema: z.object({
      term: z.string().min(2).describe("Search term (minimum 2 characters)"),
      item_types: z
        .array(z.enum(["deal", "person", "organization", "product", "lead"]))
        .optional()
        .describe("Limit search to specific item types"),
      limit: z.number().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
    }),
  }, withErrorHandling(async (inputs) => handleSearch(inputs, getClient())));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/tools/search.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/search.ts tests/tools/search.test.ts
git commit -m "feat: add global search tool using Pipedrive itemSearch"
```

---

## Task 18: Wire Everything Together in server.ts

**Files:**
- Modify: `src/server.ts`
- Modify: `api/mcp.ts`

- [ ] **Step 1: Update server.ts to register all tools**

```typescript
// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PipedriveClient } from "./pipedrive/client.js";
import { FieldMapper } from "./pipedrive/fields.js";
import { TokenStore } from "./auth/token-store.js";
import { refreshAccessToken } from "./auth/oauth.js";
import { registerDealTools } from "./tools/deals.js";
import { registerActivityTools } from "./tools/activities.js";
import { registerPersonTools } from "./tools/persons.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerSearchTool } from "./tools/search.js";

export function createServer(deps: {
  getClient: () => PipedriveClient;
  getFieldMapper: () => FieldMapper;
}): McpServer {
  const server = new McpServer({
    name: "pipedrive-mcp",
    version: "0.1.0",
  });

  const { getClient, getFieldMapper } = deps;

  registerSearchTool(server, getClient);
  registerDealTools(server, getClient, getFieldMapper);
  registerActivityTools(server, getClient);
  registerPersonTools(server, getClient, getFieldMapper);
  registerOrganizationTools(server, getClient, getFieldMapper);
  registerPipelineTools(server, getClient);
  registerNoteTools(server, getClient);

  return server;
}
```

- [ ] **Step 2: Update api/mcp.ts to resolve user auth and create client**

```typescript
// api/mcp.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";
import { PipedriveClient } from "../src/pipedrive/client.js";
import { FieldMapper } from "../src/pipedrive/fields.js";
import { TokenStore } from "../src/auth/token-store.js";
import { refreshAccessToken } from "../src/auth/oauth.js";

const fieldMapper = new FieldMapper();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Resolve user identity from Authorization header
  // Expected format: Bearer <pipedrive-user-id>
  const authHeader = req.headers.authorization;
  const userId = authHeader?.replace("Bearer ", "");

  if (!userId) {
    res.status(401).json({
      error: "Missing authorization. Add Bearer <pipedrive-user-id> header. Authorize at /api/auth/authorize first.",
    });
    return;
  }

  const encryptionKey = process.env.ENCRYPTION_KEY!;
  const tokenStore = new TokenStore(encryptionKey);

  let tokens = await tokenStore.retrieve(userId);
  if (!tokens) {
    res.status(401).json({
      error: `No tokens found for user ${userId}. Please authorize at /api/auth/authorize`,
    });
    return;
  }

  // Refresh token if expired (with 5-minute buffer)
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    try {
      tokens = await refreshAccessToken({
        refreshToken: tokens.refreshToken,
        clientId: process.env.PIPEDRIVE_CLIENT_ID!,
        clientSecret: process.env.PIPEDRIVE_CLIENT_SECRET!,
      });
      await tokenStore.store(userId, tokens);
    } catch {
      res.status(401).json({
        error: "Token refresh failed. Please re-authorize at /api/auth/authorize",
      });
      return;
    }
  }

  const client = new PipedriveClient({
    accessToken: tokens.accessToken,
    apiDomain: tokens.apiDomain,
  });

  // Load field mapping (cached with 1h TTL)
  await fieldMapper.load({
    accessToken: tokens.accessToken,
    apiDomain: tokens.apiDomain,
  });

  const server = createServer({
    getClient: () => client,
    getFieldMapper: () => fieldMapper,
  });

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/server.ts api/mcp.ts
git commit -m "feat: wire all tools into MCP server with auth resolution"
```

---

## Task 19: Full Integration Verification

- [ ] **Step 1: Run complete test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify Vercel build**

Run: `npx vercel build`
Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

If any fixes were applied during verification, commit them:
```bash
git add -A
git commit -m "fix: resolve build/test issues from integration verification"
```
