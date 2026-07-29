import Link from "next/link";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { PageSearchParams } from "@/lib/pagination";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

function paramValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function hiddenParams(searchParams: PageSearchParams, excludedKeys: string[]) {
  const excluded = new Set(excludedKeys);

  return Object.entries(searchParams).flatMap(([key, value]) => {
    if (excluded.has(key) || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.map((item, index) => <input key={`${key}-${index}`} name={key} type="hidden" value={item} />);
    }
    return <input key={key} name={key} type="hidden" value={value} />;
  });
}

function clearHref(pathname: string, searchParams: PageSearchParams, excludedKeys: string[]) {
  const params = new URLSearchParams();
  const excluded = new Set(excludedKeys);

  for (const [key, value] of Object.entries(searchParams)) {
    if (excluded.has(key) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function TableSearch({
  label,
  language = "es",
  name = "q",
  pathname,
  placeholder,
  resetPageKeys = ["page"],
  searchParams,
}: {
  label: string;
  language?: FiscalixLanguage;
  name?: string;
  pathname: string;
  placeholder: string;
  resetPageKeys?: string[];
  searchParams: PageSearchParams;
}) {
  const t = createTranslator(language);
  const value = paramValue(searchParams[name]);
  const excludedKeys = [name, ...resetPageKeys];

  return (
    <form action={pathname} className="table-search" method="get" role="search">
      <Icon name="search" />
      {hiddenParams(searchParams, excludedKeys)}
      <input aria-label={label} defaultValue={value} name={name} placeholder={placeholder} type="search" />
      {value.trim() ? (
        <Link className="table-search-clear" href={clearHref(pathname, searchParams, excludedKeys)}>
          {t("button.clear")}
        </Link>
      ) : (
        <button className="table-search-submit" type="submit">
          {t("button.search")}
        </button>
      )}
    </form>
  );
}
