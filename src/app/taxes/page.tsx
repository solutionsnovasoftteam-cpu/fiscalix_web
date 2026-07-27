import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getAccessibleCompanies } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";

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

const money = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

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

function taxBaseLabel(obligation: TaxObligation, base: number) {
  if (obligation.activa === false) return "No aplica";
  return isIvaObligation(obligation.nombre) || isIsrObligation(obligation.nombre) ? money.format(base) : "—";
}

function taxEstimateLabel(obligation: TaxObligation, base: number) {
  if (obligation.activa === false) return "No aplica";
  if (isIvaObligation(obligation.nombre)) return money.format(ivaFromIncome(base));
  if (isIsrObligation(obligation.nombre)) return money.format(isrFromIncome(base));
  return "Pendiente de configurar";
}

export default async function TaxesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const resolvedSearchParams = await searchParams;
  const ivaQuery = searchParamText(resolvedSearchParams, "ivaQ");
  const taxQuery = searchParamText(resolvedSearchParams, "taxQ");

  const { companies, error: companiesError } = await getAccessibleCompanies(user);

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, label(company.nombre_comercial, "Sin empresa")]));
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
    money.format(row.base),
    "16%",
    row.iva,
    money.format(row.iva),
  ], ivaQuery));
  const filteredObligations = obligations.filter((obligation) => {
    const base = taxableBaseByCompany.get(obligation.empresa_id ?? "") ?? 0;
    return matchesSearch([
      label(obligation.nombre, "Impuesto por determinar"),
      obligation.descripcion,
      companyNameById.get(obligation.empresa_id ?? "") ?? "Sin empresa",
      label(obligation.periodicidad, "Pendiente"),
      taxBaseLabel(obligation, base),
      taxEstimateLabel(obligation, base),
      obligation.activa === false ? "Inactiva" : "Activa",
    ], taxQuery);
  });
  const ivaPage = paginateItems(filteredIvaRows, pageFromParam(resolvedSearchParams.ivaPage));
  const obligationsPage = paginateItems(filteredObligations, pageFromParam(resolvedSearchParams.taxPage));
  const hasError = companiesError || obligationsResult.error || incomesResult.error;

  return (
    <AppShell activeHref="/taxes" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <p>CONTROL FISCAL</p>
          <h1>Impuestos</h1>
          <span>IVA al 16% e ISR mensual estimado con tarifa progresiva 2026 sobre tus ingresos registrados.</span>
        </header>

        {hasError && (
          <section className="dashboard-alert" role="alert">
            <strong>No fue posible cargar la proyección de impuestos.</strong>
            <span>Revisa la conexión con Supabase o los permisos de las tablas fiscales y financieras.</span>
          </section>
        )}

        <section className="reports-stats">
          <article><span><Icon name="fact_check" /></span><small>Obligaciones activas</small><strong>{activeObligations.length}</strong></article>
          <article><span><Icon name="attach_money" /></span><small>Base de ingresos registrada</small><strong>{money.format(registeredBase)}</strong></article>
          <article><span><Icon name="percent" /></span><small>IVA estimado 16%</small><strong>{money.format(registeredIva)}</strong></article>
          <article><span><Icon name="calculate" /></span><small>ISR estimado 2026</small><strong>{money.format(registeredIsr)}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>IVA estimado por empresa</h2>
              <p>Se calcula como 16% de los ingresos registrados por empresa. Es una estimación informativa basada en tus datos de Fiscalix.</p>
            </div>
            <div className="table-card-actions">
              <TableSearch
                label="Buscar IVA estimado"
                name="ivaQ"
                pathname="/taxes"
                placeholder="Buscar empresa, base o IVA..."
                resetPageKeys={["ivaPage"]}
                searchParams={resolvedSearchParams}
              />
              <span>{filteredIvaRows.length} resultado{filteredIvaRows.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          {filteredIvaRows.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead><tr><th>Empresa</th><th>Base de ingresos</th><th>Tasa IVA</th><th>IVA estimado</th></tr></thead>
                  <tbody>
                    {ivaPage.items.map((row) => (
                      <tr key={row.companyId}>
                        <td><strong>{row.companyName}</strong></td>
                        <td>{money.format(row.base)}</td>
                        <td>16%</td>
                        <td>{money.format(row.iva)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={ivaPage.currentPage}
                end={ivaPage.end}
                hrefForPage={(page) => pageHref("/taxes", resolvedSearchParams, "ivaPage", page)}
                start={ivaPage.start}
                totalItems={filteredIvaRows.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="percent" /></span>
              <strong>{ivaQuery ? "No encontramos registros de IVA" : "No hay ingresos para calcular IVA"}</strong>
              <small>{ivaQuery ? "Prueba con otro término de búsqueda." : "Cuando registres ingresos asociados a una empresa, aparecerá aquí el IVA estimado al 16%."}</small>
            </div>
          )}
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>Impuestos por generar</h2>
              <p>IVA usa 16%; ISR usa cuota fija y porcentaje sobre excedente según la tarifa mensual 2026.</p>
            </div>
            <div className="table-card-actions">
              <TableSearch
                label="Buscar impuestos por generar"
                name="taxQ"
                pathname="/taxes"
                placeholder="Buscar impuesto, empresa, estado o importe..."
                resetPageKeys={["taxPage"]}
                searchParams={resolvedSearchParams}
              />
              <span>{filteredObligations.length} resultado{filteredObligations.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          {filteredObligations.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table">
                  <thead><tr><th>Impuesto potencial</th><th>Empresa</th><th>Periodicidad</th><th>Base registrada</th><th>Importe estimado</th><th>Estado</th></tr></thead>
                  <tbody>
                    {obligationsPage.items.map((obligation) => {
                      const base = taxableBaseByCompany.get(obligation.empresa_id ?? "") ?? 0;

                      return (
                        <tr key={obligation.id}>
                          <td>
                            <strong>{label(obligation.nombre, "Impuesto por determinar")}</strong>
                            {obligation.descripcion && <small>{obligation.descripcion}</small>}
                          </td>
                          <td>{companyNameById.get(obligation.empresa_id ?? "") ?? "Sin empresa"}</td>
                          <td>{label(obligation.periodicidad, "Pendiente")}</td>
                          <td>{taxBaseLabel(obligation, base)}</td>
                          <td>{taxEstimateLabel(obligation, base)}</td>
                          <td><span className={obligation.activa === false ? "admin-status suspended" : "admin-status"}>{obligation.activa === false ? "Inactiva" : "Activa"}</span></td>
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
                start={obligationsPage.start}
                totalItems={filteredObligations.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="receipt_long" /></span>
              <strong>{taxQuery ? "No encontramos impuestos" : "No hay impuestos potenciales por mostrar"}</strong>
              <small>{taxQuery ? "Prueba con otro término de búsqueda." : "Agrega una empresa y sus obligaciones fiscales para generar esta proyección."}</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
