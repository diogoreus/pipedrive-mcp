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
