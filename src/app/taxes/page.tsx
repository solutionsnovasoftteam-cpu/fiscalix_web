import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanies } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import { defaultUserPreferences, formatPreferenceMoney } from "@/lib/userPreferences.shared";

type TaxObligation = {
  activa: boolean | null;
  descripcion: string | null;
  empresa_id: string | null;
  id: string;
  nombre: string | null;
  periodicidad: string | null;
};

type IncomeRow = {
  empresa_id: string | null;
  monto: number | string | null;
};

const IVA_RATE = 0.16;
const ISR_MONTHLY_TARIFF_2026 = [
  { fixedFee: 0, lowerLimit: 0.01, rate: 0.0192, upperLimit: 844.59 },
  { fixedFee: 16.22, lowerLimit: 844.6, rate: 0.064, upperLimit: 7168.51 },
  { fixedFee: 420.95, lowerLimit: 7168.52, rate: 0.1088, upperLimit: 12598.02 },
  { fixedFee: 1011.68, lowerLimit: 12598.03, rate: 0.16, upperLimit: 14644.64 },
  { fixedFee: 1339.14, lowerLimit: 14644.65, rate: 0.1792, upperLimit: 17533.64 },
  { fixedFee: 1856.84, lowerLimit: 17533.65, rate: 0.2136, upperLimit: 35362.83 },
  { fixedFee: 5665.16, lowerLimit: 35362.84, rate: 0.2352, upperLimit: 55736.68 },
  { fixedFee: 10457.09, lowerLimit: 55736.69, rate: 0.3, upperLimit: 106410.5 },
  { fixedFee: 25659.23, lowerLimit: 106410.51, rate: 0.32, upperLimit: 141880.66 },
  { fixedFee: 37009.69, lowerLimit: 141880.67, rate: 0.34, upperLimit: 425641.99 },
  { fixedFee: 133488.54, lowerLimit: 425642, rate: 0.35, upperLimit: null },
];

function label(value: string | null | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function asNumber(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isIvaObligation(value: string | null | undefined) {
  return value?.toLowerCase().includes("iva") ?? false;
}

function isIsrObligation(value: string | null | undefined) {
  return value?.toLowerCase().includes("isr") ?? false;
}

function ivaFromIncome(base: number) {
  return base * IVA_RATE;
}

function isrFromIncome(base: number) {
  if (base <= 0) return 0;

  const bracket = ISR_MONTHLY_TARIFF_2026.find((item) => (
    base >= item.lowerLimit && (item.upperLimit === null || base <= item.upperLimit)
  )) ?? ISR_MONTHLY_TARIFF_2026[ISR_MONTHLY_TARIFF_2026.length - 1];

  return Math.max(0, bracket.fixedFee + ((base - bracket.lowerLimit) * bracket.rate));
}

function taxBaseLabel(obligation: TaxObligation, base: number, money: (value: number) => string, notApplicable = "No aplica") {
  if (obligation.activa === false) return notApplicable;
  return isIvaObligation(obligation.nombre) || isIsrObligation(obligation.nombre) ? money(base) : "—";
}

function taxEstimateLabel(obligation: TaxObligation, base: number, money: (value: number) => string, notApplicable = "No aplica", pendingConfig = "Pendiente de configurar") {
  if (obligation.activa === false) return notApplicable;
  if (isIvaObligation(obligation.nombre)) return money(ivaFromIncome(base));
  if (isIsrObligation(obligation.nombre)) return money(isrFromIncome(base));
  return pendingConfig;
}

export default async function TaxesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const preferences = user.preferences ?? defaultUserPreferences;
  const t = createTranslator(preferences.language);
  const money = (value: number) => formatPreferenceMoney(value, preferences);
  const resolvedSearchParams = await searchParams;
  const ivaQuery = searchParamText(resolvedSearchParams, "ivaQ");
  const taxQuery = searchParamText(resolvedSearchParams, "taxQ");

  const { companies, error: companiesError } = await getAccessibleCompanies(user);

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, label(company.nombre_comercial, t("common.noCompany"))]));
  const [obligationsResult, incomesResult] = companyIds.length
    ? await Promise.all([
      supabase
        .from("obligaciones_fiscales")
        .select("id,empresa_id,nombre,periodicidad,descripcion,activa")
        .in("empresa_id", companyIds)
        .order("nombre"),
      supabase
        .from("ingresos")
        .select("empresa_id,monto")
        .in("empresa_id", companyIds),
    ])
    : [
      { data: [] as TaxObligation[], error: null },
      { data: [] as IncomeRow[], error: null },
    ];

  const obligations = (obligationsResult.data ?? []) as TaxObligation[];
  const incomes = (incomesResult.data ?? []) as IncomeRow[];
  const activeObligations = obligations.filter((obligation) => obligation.activa !== false);
  const taxableBaseByCompany = new Map<string, number>();

  for (const income of incomes) {
    if (!income.empresa_id) continue;
    taxableBaseByCompany.set(
      income.empresa_id,
      (taxableBaseByCompany.get(income.empresa_id) ?? 0) + asNumber(income.monto),
    );
  }

  const registeredBase = incomes.reduce((sum, income) => sum + asNumber(income.monto), 0);
  const registeredIva = ivaFromIncome(registeredBase);
  const registeredIsr = isrFromIncome(registeredBase);
  const ivaRows = companyIds.map((companyId) => {
    const base = taxableBaseByCompany.get(companyId) ?? 0;

    return {
      base,
      companyId,
      companyName: companyNameById.get(companyId) ?? "Sin empresa",
      iva: ivaFromIncome(base),
    };
  });
  const filteredIvaRows = ivaRows.filter((row) => matchesSearch([
    row.companyName,
    row.base,
    money(row.base),
    "16%",
    row.iva,
    money(row.iva),
  ], ivaQuery));
  const filteredObligations = obligations.filter((obligation) => {
    const base = taxableBaseByCompany.get(obligation.empresa_id ?? "") ?? 0;
    return matchesSearch([
      label(obligation.nombre, t("taxes.taxToDetermine")),
      obligation.descripcion,
      companyNameById.get(obligation.empresa_id ?? "") ?? t("common.noCompany"),
      label(obligation.periodicidad, t("common.pending")),
      taxBaseLabel(obligation, base, money, t("taxes.notApplicable")),
      taxEstimateLabel(obligation, base, money, t("taxes.notApplicable"), t("taxes.pendingConfig")),
      obligation.activa === false ? t("common.inactive") : t("common.active"),
    ], taxQuery);
  });
  const ivaPage = paginateItems(filteredIvaRows, pageFromParam(resolvedSearchParams.ivaPage));
  const obligationsPage = paginateItems(filteredObligations, pageFromParam(resolvedSearchParams.taxPage));
  const hasError = companiesError || obligationsResult.error || incomesResult.error;

  return (
    <AppShell activeHref="/taxes" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <p>{t("taxes.eyebrow")}</p>
          <h1>{t("taxes.title")}</h1>
          <span>{t("taxes.description")}</span>
        </header>

        {hasError && (
          <section className="dashboard-alert" role="alert">
            <strong>{t("taxes.loadError")}</strong>
            <span>{t("taxes.loadErrorHelp")}</span>
          </section>
        )}

        <section className="reports-stats">
          <article><span><Icon name="fact_check" /></span><small>{t("taxes.activeObligations")}</small><strong>{activeObligations.length}</strong></article>
          <article><span><Icon name="attach_money" /></span><small>{t("taxes.registeredIncomeBase")}</small><strong>{money(registeredBase)}</strong></article>
          <article><span><Icon name="percent" /></span><small>{t("taxes.estimatedIva")}</small><strong>{money(registeredIva)}</strong></article>
          <article><span><Icon name="calculate" /></span><small>{t("taxes.estimatedIsr")}</small><strong>{money(registeredIsr)}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.ivaByCompany")}</h2>
              <p>{t("taxes.ivaByCompanyHelp")}</p>
            </div>
            <div className="table-card-actions">
              <TableSearch
                label={t("taxes.searchIvaLabel")}
                language={preferences.language}
                name="ivaQ"
                pathname="/taxes"
                placeholder={t("taxes.searchIvaPlaceholder")}
                resetPageKeys={["ivaPage"]}
                searchParams={resolvedSearchParams}
              />
              <span>{resultCount(filteredIvaRows.length, preferences.language)}</span>
            </div>
          </div>

          {filteredIvaRows.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead><tr><th>{t("table.company")}</th><th>{t("taxes.incomeBase")}</th><th>{t("taxes.ivaRate")}</th><th>{t("taxes.estimatedIva")}</th></tr></thead>
                  <tbody>
                    {ivaPage.items.map((row) => (
                      <tr key={row.companyId}>
                        <td><strong>{row.companyName}</strong></td>
                        <td>{money(row.base)}</td>
                        <td>16%</td>
                        <td>{money(row.iva)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={ivaPage.currentPage}
                end={ivaPage.end}
                hrefForPage={(page) => pageHref("/taxes", resolvedSearchParams, "ivaPage", page)}
                language={preferences.language}
                start={ivaPage.start}
                totalItems={filteredIvaRows.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="percent" /></span>
              <strong>{ivaQuery ? t("taxes.noIvaSearch") : t("taxes.noIva")}</strong>
              <small>{ivaQuery ? t("common.tryAnotherSearch") : t("taxes.noIvaHelp")}</small>
            </div>
          )}
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.toGenerate")}</h2>
              <p>{t("taxes.toGenerateHelp")}</p>
            </div>
            <div className="table-card-actions">
              <TableSearch
                label={t("taxes.searchTaxesLabel")}
                language={preferences.language}
                name="taxQ"
                pathname="/taxes"
                placeholder={t("taxes.searchTaxesPlaceholder")}
                resetPageKeys={["taxPage"]}
                searchParams={resolvedSearchParams}
              />
              <span>{resultCount(filteredObligations.length, preferences.language)}</span>
            </div>
          </div>

          {filteredObligations.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead><tr><th>{t("taxes.potentialTax")}</th><th>{t("table.company")}</th><th>{t("taxes.periodicity")}</th><th>{t("taxes.registeredBase")}</th><th>{t("taxes.estimatedAmount")}</th><th>{t("table.status")}</th></tr></thead>
                  <tbody>
                    {obligationsPage.items.map((obligation) => {
                      const base = taxableBaseByCompany.get(obligation.empresa_id ?? "") ?? 0;

                      return (
                        <tr key={obligation.id}>
                          <td>
                            <strong>{label(obligation.nombre, t("taxes.taxToDetermine"))}</strong>
                            {obligation.descripcion && <small>{obligation.descripcion}</small>}
                          </td>
                          <td>{companyNameById.get(obligation.empresa_id ?? "") ?? t("common.noCompany")}</td>
                          <td>{label(obligation.periodicidad, t("common.pending"))}</td>
                          <td>{taxBaseLabel(obligation, base, money, t("taxes.notApplicable"))}</td>
                          <td>{taxEstimateLabel(obligation, base, money, t("taxes.notApplicable"), t("taxes.pendingConfig"))}</td>
                          <td><span className={obligation.activa === false ? "admin-status suspended" : "admin-status"}>{obligation.activa === false ? t("common.inactive") : t("common.active")}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={obligationsPage.currentPage}
                end={obligationsPage.end}
                hrefForPage={(page) => pageHref("/taxes", resolvedSearchParams, "taxPage", page)}
                language={preferences.language}
                start={obligationsPage.start}
                totalItems={filteredObligations.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="receipt_long" /></span>
              <strong>{taxQuery ? t("taxes.noSearch") : t("taxes.empty")}</strong>
              <small>{taxQuery ? t("common.tryAnotherSearch") : t("taxes.emptyHelp")}</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
