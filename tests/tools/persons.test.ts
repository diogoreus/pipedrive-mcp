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
