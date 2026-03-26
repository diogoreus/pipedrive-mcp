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
      expect(url).toBe("https://company.pipedrive.com/api/v2/deals/1?api_token=test-token");
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
