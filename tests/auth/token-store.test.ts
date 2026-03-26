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
