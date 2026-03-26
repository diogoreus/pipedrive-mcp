// src/tools/persons.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { FieldMapper } from "../pipedrive/fields.js";
import type { Person, Deal, Activity, Organization } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListPersons(
  inputs: { owner_id?: number; org_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.org_id) params.org_id = String(inputs.org_id);
  if (inputs.cursor) params.cursor = inputs.cursor;

  const persons = await client.get<Person[]>("/api/v2/persons", params);
  const translated = persons.map((p) => fieldMapper.translateResponse(p as unknown as Record<string, unknown>));
  return jsonResult({ persons: translated, count: translated.length });
}

export async function handleGetPerson(
  inputs: { id: number },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const person = await client.get<Person>(`/api/v2/persons/${inputs.id}`);

  const [deals, activities, org] = await Promise.all([
    client.get<Deal[]>("/api/v2/deals", { person_id: String(inputs.id), limit: "50" }).catch(() => []),
    client.get<Activity[]>("/api/v2/activities", { person_id: String(inputs.id), limit: "50" }).catch(() => []),
    person.org_id
      ? client.get<Organization>(`/api/v2/organizations/${person.org_id}`).catch(() => null)
      : Promise.resolve(null),
  ]);

  const translatedPerson = fieldMapper.translateResponse(person as unknown as Record<string, unknown>);
  return jsonResult({ person: translatedPerson, deals, activities, organization: org });
}

export async function handleCreatePerson(
  inputs: {
    name: string;
    owner_id?: number;
    org_id?: number;
    emails?: Array<{ value: string; primary?: boolean; label?: string }>;
    phones?: Array<{ value: string; primary?: boolean; label?: string }>;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const person = await client.post<Person>("/api/v2/persons", {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(person);
}

export async function handleUpdatePerson(
  inputs: {
    id: number;
    name?: string;
    owner_id?: number;
    org_id?: number;
    emails?: Array<{ value: string; primary?: boolean; label?: string }>;
    phones?: Array<{ value: string; primary?: boolean; label?: string }>;
    custom_fields?: Record<string, unknown>;
  },
  client: PipedriveClient,
  fieldMapper: FieldMapper
): Promise<ToolResult> {
  const { id, custom_fields, ...rest } = inputs;
  const resolvedCustom = custom_fields ? fieldMapper.resolveWriteFields(custom_fields) : {};
  const person = await client.patch<Person>(`/api/v2/persons/${id}`, {
    ...rest,
    custom_fields: Object.keys(resolvedCustom).length > 0 ? resolvedCustom : undefined,
  });
  return jsonResult(person);
}

export function registerPersonTools(
  server: McpServer,
  getClient: () => PipedriveClient,
  getFieldMapper: () => FieldMapper
): void {
  server.tool("list-persons", {
    description: "List contacts with filters (owner, org). Custom field names resolved.",
    inputSchema: z.object({
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      org_id: z.number().optional().describe("Filter by organization ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListPersons(inputs, getClient(), getFieldMapper())));

  server.tool("get-person", {
    description: "Get full person detail with associated deals, activities, and organization.",
    inputSchema: z.object({
      id: z.number().describe("Person ID"),
    }),
  }, withErrorHandling(async (inputs) => handleGetPerson(inputs, getClient(), getFieldMapper())));

  server.tool("create-person", {
    description: "Create a new contact.",
    inputSchema: z.object({
      name: z.string().describe("Person name (required)"),
      owner_id: z.number().optional().describe("Owner user ID"),
      org_id: z.number().optional().describe("Organization ID"),
      emails: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Email addresses"),
      phones: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Phone numbers"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleCreatePerson(inputs, getClient(), getFieldMapper())));

  server.tool("update-person", {
    description: "Update a contact's fields.",
    inputSchema: z.object({
      id: z.number().describe("Person ID to update"),
      name: z.string().optional().describe("Person name"),
      owner_id: z.number().optional().describe("Owner user ID"),
      org_id: z.number().optional().describe("Organization ID"),
      emails: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Email addresses"),
      phones: z.array(z.object({
        value: z.string(),
        primary: z.boolean().optional(),
        label: z.string().optional(),
      })).optional().describe("Phone numbers"),
      custom_fields: z.record(z.unknown()).optional().describe("Custom fields (human-readable names)"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdatePerson(inputs, getClient(), getFieldMapper())));
}
