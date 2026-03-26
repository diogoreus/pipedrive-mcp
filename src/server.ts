import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "pipedrive-mcp",
    version: "0.1.0",
  });

  // Tools are registered in subsequent tasks
  return server;
}
