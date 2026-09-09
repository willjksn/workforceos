export const DEFAULT_LIST_PAGE_SIZE = 25;
export const MAX_LIST_PAGE_SIZE = 100;

export type ListPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListPageQuery = {
  page?: number | string | null;
  pageSize?: number | string | null;
};

function asPositiveInt(value: number | string | null | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export function parseListPage(input: ListPageQuery = {}, defaults?: { pageSize?: number }) {
  const page = asPositiveInt(input.page, 1);
  const requested = asPositiveInt(input.pageSize, defaults?.pageSize ?? DEFAULT_LIST_PAGE_SIZE);
  const pageSize = Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, requested));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function listPageResult<T>(items: T[], total: number, page: number, pageSize: number): ListPage<T> {
  return { items, total, page, pageSize };
}

export function listPageHref(
  pathname: string,
  current: URLSearchParams | Record<string, string | undefined>,
  page: number,
) {
  const params = current instanceof URLSearchParams ? new URLSearchParams(current) : new URLSearchParams();
  if (!(current instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(current)) {
      if (value) params.set(key, value);
    }
  }
  if (page <= 1) params.delete("page");
  else params.set("page", String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
