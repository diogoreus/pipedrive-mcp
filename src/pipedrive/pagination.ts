export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export function clampLimit(limit: number | undefined): number {
  const val = limit ?? 50;
  return Math.min(Math.max(val, 1), 200);
}
