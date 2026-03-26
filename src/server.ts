import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PipedriveClient } from "./pipedrive/client.js";
import { FieldMapper } from "./pipedrive/fields.js";
import { TokenStore } from "./auth/token-store.js";
import { refreshAccessToken } from "./auth/oauth.js";
import { registerDealTools } from "./tools/deals.js";
import { registerActivityTools } from "./tools/activities.js";
import { registerPersonTools } from "./tools/persons.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerPipelineTools } from "./tools/pipelines.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerSearchTool } from "./tools/search.js";

export function createServer(deps: {
  getClient: () => PipedriveClient;
  getFieldMapper: () => FieldMapper;
}): McpServer {
  const server = new McpServer({
    name: "pipedrive-mcp",
    version: "0.1.0",
  });

  const { getClient, getFieldMapper } = deps;

  registerSearchTool(server, getClient);
  registerDealTools(server, getClient, getFieldMapper);
  registerActivityTools(server, getClient);
  registerPersonTools(server, getClient, getFieldMapper);
  registerOrganizationTools(server, getClient, getFieldMapper);
  registerPipelineTools(server, getClient);
  registerNoteTools(server, getClient);

  return server;
}
