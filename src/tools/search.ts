// src/tools/search.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PipedriveClient } from "../pipedrive/client.js";
import type { SearchResult } from "../pipedrive/types.js";
import { jsonResult, withErrorHandling, type ToolResult } from "./helpers.js";

export async function handleSearch(
  inputs: {
    term: string;
    item_types?: string[];
    limit?: number;
  },
  client: PipedriveClient
): Promise<ToolResult> {
  const params: Record<string, string> = {
    term: inputs.term,
    limit: String(Math.min(inputs.limit ?? 20, 100)),
  };
  if (inputs.item_types?.length) {
    params.item_types = inputs.item_types.join(",");
  }

  const data = await client.get<{ items: SearchResult[] }>(
    "/api/v1/itemSearch",
    params
  );

  return jsonResult({ results: data.items, count: data.items.length });
}

export function registerSearchTool(
  server: McpServer,
  getClient: () => PipedriveClient
): void {
  server.tool("search", "Global search across deals, persons, and organizations. Returns results grouped by type.", {
    term: z.string().min(2).describe("Search term (minimum 2 characters)"),
    item_types: z
      .array(z.enum(["deal", "person", "organization", "product", "lead"]))
      .optional()
      .describe("Limit search to specific item types"),
    limit: z.number().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
  }, withErrorHandling(async (inputs) => handleSearch(inputs, getClient())));
}
