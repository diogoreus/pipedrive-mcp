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
