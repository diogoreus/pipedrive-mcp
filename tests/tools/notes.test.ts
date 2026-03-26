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
