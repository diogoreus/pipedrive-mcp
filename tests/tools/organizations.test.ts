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
