import { PipedriveError, toMcpError } from "../utils/errors.js";

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function withErrorHandling(
  handler: (...args: any[]) => Promise<ToolResult>
): (...args: any[]) => Promise<ToolResult> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof PipedriveError) return toMcpError(err);
      throw err;
    }
  };
}
