// src/tools/activities.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { Activity } from "../pipedrive/types.js";
import { clampLimit } from "../pipedrive/pagination.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleListActivities(
  inputs: {
    deal_id?: number;
    owner_id?: number;
    type?: string;
    done?: boolean;
    due_date_from?: string;
    due_date_to?: string;
    limit?: number;
    cursor?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = {
    limit: String(clampLimit(inputs.limit)),
  };
  if (inputs.deal_id) params.deal_id = String(inputs.deal_id);
  if (inputs.owner_id) params.owner_id = String(inputs.owner_id);
  if (inputs.type) params.type = inputs.type;
  if (inputs.done !== undefined) params.done = inputs.done ? "1" : "0";
  if (inputs.due_date_from) params.updated_since = inputs.due_date_from;
  if (inputs.due_date_to) params.updated_until = inputs.due_date_to;
  if (inputs.cursor) params.cursor = inputs.cursor;

  const activities = await client.get<Activity[]>("/api/v2/activities", params);
  return jsonResult({ activities, count: activities.length });
}

export async function handleCreateActivity(
  inputs: {
    subject: string;
    type: string;
    due_date: string;
    due_time?: string;
    duration?: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    owner_id?: number;
    done?: boolean;
    busy?: boolean;
    note?: string;
    location?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const activity = await client.post<Activity>("/api/v2/activities", inputs);
  return jsonResult(activity);
}

export async function handleUpdateActivity(
  inputs: {
    id: number;
    subject?: string;
    type?: string;
    due_date?: string;
    due_time?: string;
    duration?: string;
    deal_id?: number;
    person_id?: number;
    org_id?: number;
    done?: boolean;
    note?: string;
    location?: string;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const { id, ...rest } = inputs;
  const activity = await client.patch<Activity>(`/api/v2/activities/${id}`, rest);
  return jsonResult(activity);
}

export function registerActivityTools(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("list-activities", {
    description: "List activities with filters (deal, user, type, done/undone, date range).",
    inputSchema: z.object({
      deal_id: z.number().optional().describe("Filter by deal ID"),
      owner_id: z.number().optional().describe("Filter by owner user ID"),
      type: z.string().optional().describe("Filter by activity type (call, meeting, task, etc.)"),
      done: z.boolean().optional().describe("Filter by completion status"),
      due_date_from: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
      due_date_to: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    }),
  }, withErrorHandling(async (inputs) => handleListActivities(inputs, getClient())));

  server.tool("create-activity", {
    description: "Schedule a new activity (call, meeting, task, etc.) on a deal.",
    inputSchema: z.object({
      subject: z.string().describe("Activity subject/title"),
      type: z.string().describe("Activity type (call, meeting, task, deadline, email, lunch)"),
      due_date: z.string().describe("Due date (YYYY-MM-DD)"),
      due_time: z.string().optional().describe("Due time (HH:MM)"),
      duration: z.string().optional().describe("Duration (HH:MM)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      owner_id: z.number().optional().describe("Assigned owner user ID"),
      done: z.boolean().optional().describe("Whether already completed"),
      busy: z.boolean().optional().describe("Whether marked as busy"),
      note: z.string().optional().describe("Activity note/description"),
      location: z.string().optional().describe("Location"),
    }),
  }, withErrorHandling(async (inputs) => handleCreateActivity(inputs, getClient())));

  server.tool("update-activity", {
    description: "Update an existing activity or mark it as done.",
    inputSchema: z.object({
      id: z.number().describe("Activity ID to update"),
      subject: z.string().optional().describe("Activity subject"),
      type: z.string().optional().describe("Activity type"),
      due_date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      due_time: z.string().optional().describe("Due time (HH:MM)"),
      duration: z.string().optional().describe("Duration (HH:MM)"),
      deal_id: z.number().optional().describe("Associated deal ID"),
      person_id: z.number().optional().describe("Associated person ID"),
      org_id: z.number().optional().describe("Associated organization ID"),
      done: z.boolean().optional().describe("Mark as done/undone"),
      note: z.string().optional().describe("Activity note"),
      location: z.string().optional().describe("Location"),
    }),
  }, withErrorHandling(async (inputs) => handleUpdateActivity(inputs, getClient())));
}
