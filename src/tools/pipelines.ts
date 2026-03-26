// src/tools/pipelines.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Pipeline, Stage, Deal } from "../pipedrive/types.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListPipelines(
  client: PipedriveClient
): Promise<ToolResult> {
  const [pipelines, stages] = await Promise.all([
    client.get<Pipeline[]>("/api/v2/pipelines", { limit: "500" }),
    client.get<Stage[]>("/api/v2/stages", { limit: "500" }),
  ]);

  const stagesByPipeline = new Map<number, Stage[]>();
  for (const stage of stages) {
    const existing = stagesByPipeline.get(stage.pipeline_id) ?? [];
    existing.push(stage);
    stagesByPipeline.set(stage.pipeline_id, existing);
  }

  const enriched = pipelines.map((p) => ({
    ...p,
    stages: (stagesByPipeline.get(p.id) ?? []).sort(
      (a, b) => a.order_nr - b.order_nr
    ),
  }));

  return jsonResult({ pipelines: enriched });
}

export async function handleGetPipelineDeals(
  inputs: { pipeline_id: number; stage_id?: number },
  client: PipedriveClient
): Promise<ToolResult> {
  const stageParams: Record<string, string> = {
    pipeline_id: String(inputs.pipeline_id),
    limit: "500",
  };
  const dealParams: Record<string, string> = {
    pipeline_id: String(inputs.pipeline_id),
    status: "open",
    limit: "200",
  };
  if (inputs.stage_id) dealParams.stage_id = String(inputs.stage_id);

  const [stages, deals] = await Promise.all([
    client.get<Stage[]>("/api/v2/stages", stageParams),
    client.get<Deal[]>("/api/v2/deals", dealParams),
  ]);

  const sortedStages = stages.sort((a, b) => a.order_nr - b.order_nr);

  const dealsByStage = new Map<number, Array<{
    id: number;
    title: string;
    value: number;
    person_id: number | null;
    next_activity_date: string | null;
  }>>();

  for (const deal of deals) {
    const summary = {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      person_id: deal.person_id,
      next_activity_date: deal.next_activity_date,
    };
    const existing = dealsByStage.get(deal.stage_id) ?? [];
    existing.push(summary);
    dealsByStage.set(deal.stage_id, existing);
  }

  const result = sortedStages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    order_nr: stage.order_nr,
    deals: dealsByStage.get(stage.id) ?? [],
    deal_count: (dealsByStage.get(stage.id) ?? []).length,
  }));

  return jsonResult({
    pipeline_id: inputs.pipeline_id,
    total_deals: deals.length,
    stages: result,
  });
}

export function registerPipelineTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-pipelines", "List all pipelines with their stages inline.", {}, withErrorHandling(async () => handleListPipelines(getClient())));

  server.tool("get-pipeline-deals", "Get all deals in a pipeline grouped by stage. Returns summary data per deal (title, value, next activity date). Capped at 200 deals.", {
    pipeline_id: z.number().describe("Pipeline ID"),
    stage_id: z.number().optional().describe("Optional: filter to a specific stage"),
  }, withErrorHandling(async (inputs) => handleGetPipelineDeals(inputs, getClient())));
}
