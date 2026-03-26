import { PipedriveError, mapPipedriveError } from "../utils/errors.js";
import type { PipedriveResponse } from "./types.js";
import type { PaginatedResult } from "./pagination.js";

const MAX_RETRIES = 2;

export interface PipedriveClientConfig {
  accessToken: string;
  apiDomain: string;
}

export class PipedriveClient {
  private accessToken: string;
  private apiDomain: string;

  constructor(config: PipedriveClientConfig) {
    this.accessToken = config.accessToken;
    this.apiDomain = config.apiDomain;
  }

  async get<T>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    return this.request<T>(url, { method: "GET" });
  }

  async getWithPagination<T>(
    path: string,
    params: Record<string, string>
  ): Promise<PaginatedResult<T>> {
    const url = this.buildUrl(path, params);
    return this.requestFull<T>(url, { method: "GET" });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.apiDomain);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<T> {
    const res = await this.fetchWithRetry(url, init, retryCount);
    const json = (await res.json()) as PipedriveResponse<T>;
    return json.data;
  }

  private async requestFull<T>(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<PaginatedResult<T>> {
    const res = await this.fetchWithRetry(url, init, retryCount);
    const json = (await res.json()) as PipedriveResponse<T[]>;
    return {
      data: json.data,
      nextCursor: json.additional_data?.next_cursor,
      hasMore: !!json.additional_data?.next_cursor,
    };
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...((init.headers as Record<string, string>) ?? {}),
      },
    });

    if (res.ok) return res;

    // Retry on 429
    if (res.status === 429 && retryCount < MAX_RETRIES) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep(retryAfter * 1000);
      return this.fetchWithRetry(url, init, retryCount + 1);
    }

    // Map to PipedriveError
    let message: string;
    try {
      const json = await res.json();
      message = json.error ?? json.message ?? `HTTP ${res.status}`;
    } catch {
      message = await res.text().catch(() => `HTTP ${res.status}`);
    }

    const retryAfter = res.status === 429
      ? parseInt(res.headers.get("Retry-After") ?? "0", 10)
      : undefined;

    throw mapPipedriveError(res.status, message, { retryAfter });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
