// src/tools/deals.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Deal, Activity, Person, Organization, Note, Stage } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListDeals(
  inputs: {
    owner_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    limit?: number;
    cursor?: string;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = {
    limit: String(clampLimit(inputs.limit)),
  };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.pipeline_id) params.pipeline_id = String(inputs.pipeline_id);
  if (inputs.stage_id) params.stage_id = String(inputs.stage_id);
  if (inputs.status) params.status = inputs.status;
  if (inputs.cursor) params.cursor = inputs.cursor;

  const result = await client.getWithPagination<Deal>("/api/v2/deals", params);
  const translated = result.data.map((d) => fieldMapper.translateResponse(d as unknown as Record<string, unknown>));

  return jsonResult({ deals: translated, count: translated.length, nextCursor: result.nextCursor });
}

export async function handleGetDeal(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const deal = await client.get<Deal>(`/api/v2/deals/${inputs.id}`);

  // Fetch related data in parallel
  const [activities, person, org, notes, stages] = await Promise.all([
    client.get<Activity[]>("/api/v2/activities", { deal_id: String(inputs.id), limit: "50" }).catch(() => []),
    deal.person_id
      ? client.get<Person>(`/api/v2/persons/${deal.person_id}`).catch(() => null)
      : Promise.resolve(null),
    deal.org_id
      ? client.get<Organization>(`/api/v2/organizations/${deal.org_id}`).catch(() => null)
      : Promise.resolve(null),
    client.get<Note[]>("/api/v1/notes", { deal_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Stage[]>("/api/v2/stages", { pipeline_id: String(deal.pipeline_id) }).catch(() => []),
  ]);

  const stage = stages.find((s) => s.id === deal.stage_id);
  const translatedDeal = fieldMapper.translateResponse(deal as unknown as Record<string, unknown>);

  return jsonResult({
    deal: translatedDeal,
    stage_name: stage?.name ?? null,
    person,
    organization: org,
    activities,
    notes,
  });
}

export async function handleCreateDeal(
  inputs: {
    title: string;
    value?: number;
    currency?: string;
    person_id?: number;
    org_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    expected_close_date?: string;
    owner_id?: number;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields
    ? fieldMapper.resolveWriteFields(custom_fields)
    : {};

  const deal = await client.post<Deal>("/api/v2/deals", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });

  return jsonResult(deal);
}

export async function handleUpdateDeal(
  inputs: {
    id: number;
    title?: string;
    value?: number;
    currency?: string;
    person_id?: number;
    org_id?: number;
    pipeline_id?: number;
    stage_id?: number;
    status?: string;
    expected_close_date?: string;
    owner_id?: number;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields
    ? fieldMapper.resolveWriteFields(custom_fields)
    : {};

  const deal = await client.patch<Deal>(`/api/v2/deals/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });

  return jsonResult(deal);
}

export function registerDealTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-deals", "List deals with filters (owner, stage, pipeline, status). Returns deal data with custom field names resolved. Use get-deal for full enrichment.", {
    owner_id: z.number().optional().describe("Filter by deal owner user ID"),
    pipeline_id: z.number().optional().describe("Filter by pipeline ID"),
    stage_id: z.number().optional().describe("Filter by stage ID"),
    status: z.enum(["open", "won", "lost"]).optional().describe("Filter by deal status"),
    limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
    cursor: z.string().optional().describe("Pagination cursor from previous response"),
  }, withErrorHandling(async (inputs) => handleListDeals(inputs, getClient(), getFieldMapper())));

  server.tool("get-deal", "Get a single deal with full enrichment: activities, person, organization, stage info, custom fields, and notes.", {
    id: z.number().describe("The deal ID"),
  }, withErrorHandling(async (inputs) => handleGetDeal(inputs, getClient(), getFieldMapper())));

  server.tool("create-deal", "Create a new deal with optional associations.", {
    title: z.string().describe("Deal title (required)"),
    value: z.number().optional().describe("Deal monetary value"),
    currency: z.string().optional().describe("Currency code (e.g., USD)"),
    person_id: z.number().optional().describe("Associated person ID"),
    org_id: z.number().optional().describe("Associated organization ID"),
    pipeline_id: z.number().optional().describe("Pipeline ID"),
    stage_id: z.number().optional().describe("Stage ID"),
    status: z.enum(["open", "won", "lost"]).optional().describe("Deal status"),
    expected_close_date: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
    owner_id: z.number().optional().describe("Owner user ID"),
    custom_fields: z.record(z.unknown()).optional().describe("Custom fields (use human-readable names)"),
  }, withErrorHandling(async (inputs) => handleCreateDeal(inputs, getClient(), getFieldMapper())));

  server.tool("update-deal", "Update an existing deal's fields.", {
    id: z.number().describe("The deal ID to update"),
    title: z.string().optional().describe("Deal title"),
    value: z.number().optional().describe("Deal monetary value"),
    currency: z.string().optional().describe("Currency code"),
    person_id: z.number().optional().describe("Associated person ID"),
    org_id: z.number().optional().describe("Associated organization ID"),
    pipeline_id: z.number().optional().describe("Pipeline ID"),
    stage_id: z.number().optional().describe("Stage ID"),
    status: z.enum(["open", "won", "lost"]).optional().describe("Deal status"),
    expected_close_date: z.string().optional().describe("Expected close date (YYYY-MM-DD)"),
    owner_id: z.number().optional().describe("Owner user ID"),
    custom_fields: z.record(z.unknown()).optional().describe("Custom fields (use human-readable names)"),
  }, withErrorHandling(async (inputs) => handleUpdateDeal(inputs, getClient(), getFieldMapper())));
}
