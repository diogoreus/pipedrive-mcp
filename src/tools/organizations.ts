// src/tools/organizations.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Organization, Person, Deal } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListOrganizations(
  inputs: { owner_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.cursor) params.cursor = inputs.cursor;

  const orgs = await client.get<Organization[]>("/api/v2/organizations", params);
  const translated = orgs.map((o) => fieldMapper.translateResponse(o as unknown as Record<string, unknown>));
  return jsonResult({ organizations: translated, count: translated.length });
}

export async function handleGetOrganization(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const org = await client.get<Organization>(`/api/v2/organizations/${inputs.id}`);

  const [persons, deals] = await Promise.all([
    client.get<Person[]>("/api/v2/persons", { org_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Deal[]>("/api/v2/deals", { org_id: String(inputs.id), limit: "50" }).catch(() => []),
  ]);

  const translatedOrg = fieldMapper.translateResponse(org as unknown as Record<string, unknown>);
  return jsonResult({ organization: translatedOrg, persons, deals });
}

export async function handleCreateOrganization(
  inputs: { name: string; owner_id?: number; address?: string; custom_fields?: Record<string, unknown> },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const org = await client.post<Organization>("/api/v2/organizations", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(org);
}

export async function handleUpdateOrganization(
  inputs: { id: number; name?: string; owner_id?: number; address?: string; custom_fields?: Record<string, unknown> },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const org = await client.patch<Organization>(`/api/v2/organizations/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(org);
}

export function registerOrganizationTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-organizations", {
    description: "List organizations with filters (owner). Custom field names resolved.",
    inputSchema: z.object({
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListOrganizations(inputs, getClient(), getFieldMapper())));

  server.tool("get-organization", {
    description: "Get full organization detail with associated persons and deals.",
    inputSchema: z.object({
      id: z.number().describe("Organization ID"),
    }),
  }, withErrorHandling(async (inputs) => handleGetOrganization(inputs, getClient(), getFieldMapper())));

  server.tool("create-organization", {
    description: "Create a new organization.",
    inputSchema: z.object({
      name: z.string().describe("Organization name (required)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      address: z.string().optional().describe("Address"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateOrganization(inputs, getClient(), getFieldMapper())));

  server.tool("update-organization", {
    description: "Update an organization's fields.",
    inputSchema: z.object({
      id: z.number().describe("Organization ID to update"),
      name: z.string().optional().describe("Organization name"),
      owner_id: z.number().optional().describe("Owner user ID"),
      address: z.string().optional().describe("Address"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateOrganization(inputs, getClient(), getFieldMapper())));
}
