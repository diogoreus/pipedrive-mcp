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
