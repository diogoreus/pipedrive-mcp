import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
} from "../../src/auth/oauth.js";

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
