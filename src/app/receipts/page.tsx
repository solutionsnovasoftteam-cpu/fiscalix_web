import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminDashboard } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

type Company = { id: string; nombre_comercial: string | null };

type FinancialRecord = {
  concepto: string | null;
  empresa_id: string | null;
  fecha: string | null;
  id: string;
  monto: number | string | null;
};

type Receipt = {
  amount: number;
  company: string;
  concept: string;
  date: string;
  folio: string;
  id: string;
  type: "Gasto" | "Ingreso";
};

const money = new Intl.NumberFormat("es-MX", { currency: "MXN", style: "currency" });
const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });

function amount(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { q = "" } = await searchParams;
  const query = q.trim().toLowerCase();
  let companies: Company[] = [];
  let companiesError: unknown = null;

  if (canViewAdminDashboard(user)) {
    const result = await supabase.from("empresas").select("id,nombre_comercial").neq("estado", "suspendida");
    companies = (result.data ?? []) as Company[];
    companiesError = result.error;
  } else {
    const result = await supabase
      .from("empresa_usuario")
      .select("empresa_id,empresas(id,nombre_comercial)")
      .eq("usuario_id", user.id);
    companies = ((result.data ?? []).flatMap((membership) => membership.empresas ?? []) as Company[]);
    companiesError = result.error;
  }

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || "Sin empresa"]));
  const [incomeResult, expenseResult] = companyIds.length
    ? await Promise.all([
      supabase.from("ingresos").select("id,concepto,monto,fecha_ingreso,empresa_id").in("empresa_id", companyIds).order("fecha_ingreso", { ascending: false }).limit(100),
      supabase.from("gastos").select("id,concepto,monto,fecha_gasto,empresa_id").in("empresa_id", companyIds).order("fecha_gasto", { ascending: false }).limit(100),
    ])
    : [{ data: [] as FinancialRecord[], error: null }, { data: [] as FinancialRecord[], error: null }];

  function receiptFrom(record: FinancialRecord, type: Receipt["type"]): Receipt {
    const folio = `${type === "Ingreso" ? "ING" : "GAS"}-${record.id.slice(0, 8).toUpperCase()}`;
    return {
      amount: amount(record.monto),
      company: companyNameById.get(record.empresa_id ?? "") ?? "Sin empresa",
      concept: record.concepto || `${type} sin descripción`,
      date: record.fecha || "",
      folio,
      id: `${type}-${record.id}`,
      type,
    };
  }

  const incomes = ((incomeResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_ingreso: string | null }>)
    .map((record) => receiptFrom({ ...record, fecha: record.fecha_ingreso }, "Ingreso"));
  const expenses = ((expenseResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_gasto: string | null }>)
    .map((record) => receiptFrom({ ...record, fecha: record.fecha_gasto }, "Gasto"));
  const allReceipts = [...incomes, ...expenses].filter((receipt) => receipt.date).sort((a, b) => b.date.localeCompare(a.date));
  const receipts = query
    ? allReceipts.filter((receipt) => [receipt.folio, receipt.company, receipt.concept, receipt.type].join(" ").toLowerCase().includes(query))
    : allReceipts;
  const hasError = companiesError || incomeResult.error || expenseResult.error;

  return (
    <AppShell activeHref="/receipts" user={user}>
      <main className="receipts-page">
        <section className="receipts-hero">
          <div className="receipts-title">
            <span className="receipts-title-icon"><Icon name="receipt_long" /></span>
            <div><p>DOCUMENTOS FISCALES</p><h1>Comprobantes</h1><span>Organiza y consulta los comprobantes generados por tu actividad.</span></div>
          </div>
          <button className="receipts-new" type="button"><Icon name="add" /> Nuevo comprobante</button>
        </section>

        <section className="receipts-summary" aria-label="Resumen de comprobantes">
          <article><span><Icon name="receipt_long" /></span><div><small>Comprobantes</small><strong>{allReceipts.length}</strong></div></article>
          <article><span><Icon name="trending_up" /></span><div><small>Ingresos respaldados</small><strong>{money.format(incomes.reduce((sum, receipt) => sum + receipt.amount, 0))}</strong></div></article>
          <article><span><Icon name="trending_down" /></span><div><small>Gastos respaldados</small><strong>{money.format(expenses.reduce((sum, receipt) => sum + receipt.amount, 0))}</strong></div></article>
        </section>

        {hasError && <section className="receipts-alert" role="alert"><Icon name="help" /> No fue posible cargar todos los comprobantes. Revisa la conexión con Supabase.</section>}

        <section className="receipts-card">
          <div className="receipts-card-top">
            <form className="receipts-search" action="/receipts" method="get">
              <Icon name="search" />
              <input defaultValue={q} name="q" placeholder="Buscar por folio, empresa, concepto o tipo..." type="search" />
              {query && <button type="submit">Buscar</button>}
            </form>
            <span className="receipts-count">{receipts.length} resultado{receipts.length === 1 ? "" : "s"}</span>
          </div>

          {receipts.length ? (
            <div className="receipts-table-wrap">
              <table className="receipts-table">
                <thead><tr><th>Folio</th><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td><span className="receipt-folio">{receipt.folio}</span><small>{receipt.company}</small></td>
                      <td>{formatDate(receipt.date)}</td>
                      <td><strong>{receipt.concept}</strong></td>
                      <td><span className={receipt.type === "Ingreso" ? "receipt-type income" : "receipt-type expense"}>{receipt.type}</span></td>
                      <td className={receipt.type === "Ingreso" ? "receipt-amount income" : "receipt-amount expense"}>{money.format(receipt.amount)}</td>
                      <td><span className="receipt-status"><i />Registrado</span></td>
                      <td><button aria-label={`Ver ${receipt.folio}`} className="receipt-action" type="button"><Icon name="history" /></button><button aria-label={`Más opciones para ${receipt.folio}`} className="receipt-action" type="button"><Icon name="more_horiz" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="receipts-empty"><span><Icon name="receipt_long" /></span><strong>{query ? "No encontramos comprobantes" : "Aún no hay comprobantes registrados"}</strong><small>{query ? "Prueba con otro término de búsqueda." : "Los ingresos y gastos registrados aparecerán aquí como comprobantes."}</small></div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
