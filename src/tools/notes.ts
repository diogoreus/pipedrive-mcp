// src/tools/notes.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Note } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListNotes(
  inputs: { deal_id?: number; person_id?: number; org_id?: number; limit?: number; cursor?: string },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = { limit: String(clampLimit(inputs.limit)) };
  if (inputs.deal_id) params.deal_id = String(inputs.deal_id);
  if (inputs.person_id) params.person_id = String(inputs.person_id);
  if (inputs.org_id) params.org_id = String(inputs.org_id);
  if (inputs.cursor) params.start = inputs.cursor; // v1 uses start/limit pagination

  const notes = await client.get<Note[]>("/api/v1/notes", params);
  return jsonResult({ notes, count: notes.length });
}

export async function handleCreateNote(
  inputs: {
    content: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    pinned_to_deal_flag?: boolean;
    pinned_to_person_flag?: boolean;
    pinned_to_organization_flag?: boolean;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const note = await client.post<Note>("/api/v1/notes", inputs);
  return jsonResult(note);
}

export async function handleUpdateNote(
  inputs: {
    id: number;
    content?: string;
    pinned_to_deal_flag?: boolean;
    pinned_to_person_flag?: boolean;
    pinned_to_organization_flag?: boolean;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const { id, ...rest } = inputs;
  const note = await client.put<Note>(`/v1/notes/${id}`, rest);
  return jsonResult(note);
}

export function registerNoteTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-notes", {
    description: "List notes for a deal, person, or organization.",
    inputSchema: z.object({
      deal_id: z.number().optional().describe("Filter by deal ID"),
      person_id: z.number().optional().describe("Filter by person ID"),
      org_id: z.number().optional().describe("Filter by organization ID"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListNotes(inputs, getClient())));

  server.tool("create-note", {
    description: "Add a note to a deal, person, or organization.",
    inputSchema: z.object({
      content: z.string().describe("Note content (HTML supported)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      pinned_to_deal_flag: z.boolean().optional().describe("Pin to deal"),
      pinned_to_person_flag: z.boolean().optional().describe("Pin to person"),
      pinned_to_organization_flag: z.boolean().optional().describe("Pin to organization"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateNote(inputs, getClient())));

  server.tool("update-note", {
    description: "Edit an existing note.",
    inputSchema: z.object({
      id: z.number().describe("Note ID to update"),
      content: z.string().optional().describe("Updated content (HTML supported)"),
      pinned_to_deal_flag: z.boolean().optional().describe("Pin to deal"),
      pinned_to_person_flag: z.boolean().optional().describe("Pin to person"),
      pinned_to_organization_flag: z.boolean().optional().describe("Pin to organization"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateNote(inputs, getClient())));
}
