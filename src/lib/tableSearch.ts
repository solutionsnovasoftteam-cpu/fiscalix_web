import type { PageSearchParams } from "@/lib/pagination";

export function searchParamText(searchParams: PageSearchParams, key: string) {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

export function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesSearch(fields: Array<string | number | null | undefined>, query: string) {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (!normalizedQuery) return true;
  return fields.some((field) => normalizeSearchText(field).includes(normalizedQuery));
}
