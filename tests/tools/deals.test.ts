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
