import { vi } from "vitest";
import type { PipedriveResponse } from "../../src/pipedrive/types.js";

export function mockFetchSuccess<T>(data: T, additionalData?: object) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      success: true,
      data,
      additional_data: additionalData,
    }),
  });
}

export function mockFetchError(status: number, message: string) {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers(
      status === 429 ? { "Retry-After": "5" } : {}
    ),
    json: async () => ({ success: false, error: message }),
    text: async () => message,
  });
}

export function mockFetchSequence(
  responses: Array<{
    ok: boolean;
    status: number;
    data?: unknown;
    headers?: Record<string, string>;
    error?: string;
  }>
) {
  const fn = vi.fn();
  for (const res of responses) {
    fn.mockResolvedValueOnce({
      ok: res.ok,
      status: res.status,
      headers: new Headers(res.headers ?? {}),
      json: async () =>
        res.ok
          ? { success: true, data: res.data }
          : { success: false, error: res.error },
      text: async () => res.error ?? "",
    });
  }
  return fn;
}
