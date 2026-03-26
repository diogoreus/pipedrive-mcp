import { describe, it, expect } from "vitest";
import {
  PipedriveError,
  mapPipedriveError,
  toMcpError,
  ErrorCode,
} from "../../src/utils/errors.js";

describe("PipedriveError", () => {
  it("creates error with code and status", () => {
    const err = new PipedriveError("Not found", "not_found", 404);
    expect(err.message).toBe("Not found");
    expect(err.code).toBe("not_found");
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("mapPipedriveError", () => {
  it("maps 404 to not_found", () => {
    const err = mapPipedriveError(404, "Deal not found");
    expect(err.code).toBe("not_found");
    expect(err.statusCode).toBe(404);
  });

  it("maps 401 to auth_expired", () => {
    const err = mapPipedriveError(401, "Unauthorized");
    expect(err.code).toBe("auth_expired");
  });

  it("maps 429 to rate_limited with retryAfter", () => {
    const err = mapPipedriveError(429, "Too many requests", { retryAfter: 5 });
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfter).toBe(5);
  });

  it("maps 400 to validation_error", () => {
    const err = mapPipedriveError(400, "Invalid field");
    expect(err.code).toBe("validation_error");
  });

  it("maps 500 to server_error", () => {
    const err = mapPipedriveError(500, "Internal error");
    expect(err.code).toBe("server_error");
  });
});

describe("toMcpError", () => {
  it("formats PipedriveError as MCP tool error result", () => {
    const err = new PipedriveError("Deal not found", "not_found", 404);
    const result = toMcpError(err);
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("not_found");
    expect(result.content[0].text).toContain("Deal not found");
  });

  it("includes retryAfter for rate_limited errors", () => {
    const err = new PipedriveError("Rate limited", "rate_limited", 429);
    err.retryAfter = 10;
    const result = toMcpError(err);
    expect(result.content[0].text).toContain("10");
  });

  it("includes reauthorize URL for auth_expired errors", () => {
    const err = new PipedriveError("Token expired", "auth_expired", 401);
    const result = toMcpError(err);
    expect(result.content[0].text).toContain("/api/auth/authorize");
  });
});
