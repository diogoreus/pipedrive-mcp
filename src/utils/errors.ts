export type ErrorCode =
  | "not_found"
  | "rate_limited"
  | "auth_expired"
  | "validation_error"
  | "server_error";

export class PipedriveError extends Error {
  code: ErrorCode;
  statusCode: number;
  retryAfter?: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, code: ErrorCode, statusCode: number) {
    super(message);
    this.name = "PipedriveError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function mapPipedriveError(
  status: number,
  message: string,
  options?: { retryAfter?: number; fieldErrors?: Record<string, string> }
): PipedriveError {
  let code: ErrorCode;
  if (status === 401) code = "auth_expired";
  else if (status === 404) code = "not_found";
  else if (status === 429) code = "rate_limited";
  else if (status >= 400 && status < 500) code = "validation_error";
  else code = "server_error";

  const err = new PipedriveError(message, code, status);
  if (options?.retryAfter) err.retryAfter = options.retryAfter;
  if (options?.fieldErrors) err.fieldErrors = options.fieldErrors;
  return err;
}

export function toMcpError(err: PipedriveError): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
} {
  let text = `Error [${err.code}]: ${err.message}`;

  if (err.code === "rate_limited" && err.retryAfter) {
    text += `\nRetry after ${err.retryAfter} seconds.`;
  }
  if (err.code === "auth_expired") {
    text += `\nPlease re-authorize at /api/auth/authorize`;
  }
  if (err.fieldErrors) {
    text += `\nField errors: ${JSON.stringify(err.fieldErrors)}`;
  }

  return {
    isError: true,
    content: [{ type: "text", text }],
  };
}
