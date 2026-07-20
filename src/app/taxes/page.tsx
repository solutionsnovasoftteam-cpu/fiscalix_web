import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  nombre_comercial: string | null;
};

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

export default async function TaxesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let companies: Company[] = [];
  let companiesError: unknown = null;

  if (canViewAdminDashboard(user)) {
    const result = await supabase
      .from("empresas")
      .select("id,nombre_comercial")
      .neq("estado", "suspendida")
      .order("nombre_comercial");
    companies = (result.data ?? []) as Company[];
    companiesError = result.error;
  } else {
    const result = await supabase
      .from("empresa_usuario")
      .select("empresa_id,empresas(id,nombre_comercial)")
      .eq("usuario_id", user.id);
    companies = ((result.data ?? [])
      .flatMap((membership) => membership.empresas ?? []) as Company[]);
    companiesError = result.error;
  }

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
  const inactiveObligations = obligations.filter((obligation) => obligation.activa === false);
  const frequencies = new Set(activeObligations.map((obligation) => obligation.periodicidad).filter(Boolean)).size;
  const taxableBaseByCompany = new Map<string, number>();

  for (const income of incomes) {
    if (!income.empresa_id) continue;
    taxableBaseByCompany.set(
      income.empresa_id,
      (taxableBaseByCompany.get(income.empresa_id) ?? 0) + asNumber(income.monto),
    );
  }

  const registeredBase = incomes.reduce((sum, income) => sum + asNumber(income.monto), 0);
  const hasError = companiesError || obligationsResult.error || incomesResult.error;

  return (
    <AppShell activeHref="/taxes" user={user}>
      <main className="reports-content">
        <header className="reports-header">
          <p>CONTROL FISCAL</p>
          <h1>Impuestos</h1>
          <span>Impuestos potenciales generados a partir de tus obligaciones e ingresos registrados.</span>
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
          <article><span><Icon name="calendar_month" /></span><small>Periodicidades</small><strong>{frequencies}</strong></article>
          <article><span><Icon name="pause_circle" /></span><small>Obligaciones inactivas</small><strong>{inactiveObligations.length}</strong></article>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>Impuestos por generar</h2>
              <p>La base usa tus ingresos registrados; el importe requiere la tasa y el cálculo fiscal correspondiente.</p>
            </div>
            <span>{obligations.length} {obligations.length === 1 ? "registro" : "registros"}</span>
          </div>

          {obligations.length ? (
            <div className="reports-table-scroll">
              <table className="reports-table">
                <thead><tr><th>Impuesto potencial</th><th>Empresa</th><th>Periodicidad</th><th>Base registrada</th><th>Importe estimado</th><th>Estado</th></tr></thead>
                <tbody>
                  {obligations.map((obligation) => (
                    <tr key={obligation.id}>
                      <td>
                        <strong>{label(obligation.nombre, "Impuesto por determinar")}</strong>
                        {obligation.descripcion && <small>{obligation.descripcion}</small>}
                      </td>
                      <td>{companyNameById.get(obligation.empresa_id ?? "") ?? "Sin empresa"}</td>
                      <td>{label(obligation.periodicidad, "Pendiente")}</td>
                      <td>{money.format(taxableBaseByCompany.get(obligation.empresa_id ?? "") ?? 0)}</td>
                      <td>{obligation.activa === false ? "No aplica" : "Por calcular"}</td>
                      <td><span className={obligation.activa === false ? "admin-status suspended" : "admin-status"}>{obligation.activa === false ? "Inactiva" : "Activa"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reports-empty">
              <span><Icon name="receipt_long" /></span>
              <strong>No hay impuestos potenciales por mostrar</strong>
              <small>Agrega una empresa y sus obligaciones fiscales para generar esta proyección.</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
