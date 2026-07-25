export const TABLE_PAGE_SIZE = 10;

export type PageSearchParams = Record<string, string | string[] | undefined>;

export function pageFromParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function totalPagesFor(totalItems: number, pageSize = TABLE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function clampPage(page: number, totalItems: number, pageSize = TABLE_PAGE_SIZE) {
  return Math.min(page, totalPagesFor(totalItems, pageSize));
}

export function paginateItems<T>(items: T[], page: number, pageSize = TABLE_PAGE_SIZE) {
  const currentPage = clampPage(page, items.length, pageSize);
  const start = (currentPage - 1) * pageSize;

  return {
    currentPage,
    end: Math.min(start + pageSize, items.length),
    items: items.slice(start, start + pageSize),
    start,
    totalPages: totalPagesFor(items.length, pageSize),
  };
}

export function paginationRangeLabel(totalItems: number, start: number, end: number) {
  if (!totalItems) return "0 registros";
  return `${start + 1}-${end} de ${totalItems}`;
}

export function pageHref(pathname: string, searchParams: PageSearchParams, pageKey: string, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === pageKey || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  if (page > 1) params.set(pageKey, String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
