import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { ReceiptsTableActions } from "@/app/receipts/receipts-table-actions";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";

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
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resolvedSearchParams = await searchParams;
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const query = q.trim().toLowerCase();
  const { companies, error: companiesError } = await getAccessibleCompanies(user);

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || "Sin empresa"]));
  const [companyIncomeResult, userIncomeResult, companyExpenseResult, userExpenseResult] = await Promise.all([
    companyIds.length
      ? supabase.from("ingresos").select("id,concepto,monto,fecha_ingreso,empresa_id").in("empresa_id", companyIds).order("fecha_ingreso", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as FinancialRecord[], error: null }),
    supabase.from("ingresos").select("id,concepto,monto,usuario_id,fecha_ingreso,empresa_id").eq("usuario_id", user.id).order("fecha_ingreso", { ascending: false }).limit(100),
    companyIds.length
      ? supabase.from("gastos").select("id,concepto,monto,fecha_gasto,empresa_id").in("empresa_id", companyIds).order("fecha_gasto", { ascending: false }).limit(100)
      : Promise.resolve({ data: [] as FinancialRecord[], error: null }),
    supabase.from("gastos").select("id,concepto,monto,usuario_id,fecha_gasto,empresa_id").eq("usuario_id", user.id).order("fecha_gasto", { ascending: false }).limit(100),
  ]);

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

  const incomesById = new Map<string, Receipt>();
  const expensesById = new Map<string, Receipt>();
  for (const record of [
    ...((companyIncomeResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_ingreso: string | null }>),
    ...(isMissingColumnError(userIncomeResult.error, "usuario_id") ? [] : (userIncomeResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_ingreso: string | null }>),
  ]) {
    incomesById.set(record.id, receiptFrom({ ...record, fecha: record.fecha_ingreso }, "Ingreso"));
  }
  for (const record of [
    ...((companyExpenseResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_gasto: string | null }>),
    ...(isMissingColumnError(userExpenseResult.error, "usuario_id") ? [] : (userExpenseResult.data ?? []) as Array<Omit<FinancialRecord, "fecha"> & { fecha_gasto: string | null }>),
  ]) {
    expensesById.set(record.id, receiptFrom({ ...record, fecha: record.fecha_gasto }, "Gasto"));
  }
  const incomes = [...incomesById.values()];
  const expenses = [...expensesById.values()];
  const allReceipts = [...incomes, ...expenses].filter((receipt) => receipt.date).sort((a, b) => b.date.localeCompare(a.date));
  const receipts = query
    ? allReceipts.filter((receipt) => [receipt.folio, receipt.company, receipt.concept, receipt.type].join(" ").toLowerCase().includes(query))
    : allReceipts;
  const receiptsPage = paginateItems(receipts, pageFromParam(resolvedSearchParams.page));
  const hasError = companiesError
    || companyIncomeResult.error
    || (!isMissingColumnError(userIncomeResult.error, "usuario_id") && userIncomeResult.error)
    || companyExpenseResult.error
    || (!isMissingColumnError(userExpenseResult.error, "usuario_id") && userExpenseResult.error);

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
            <TableSearch
              label="Buscar comprobantes"
              pathname="/receipts"
              placeholder="Buscar por folio, empresa, concepto o tipo..."
              searchParams={resolvedSearchParams}
            />
            <span className="receipts-count">{receipts.length} resultado{receipts.length === 1 ? "" : "s"}</span>
          </div>

          {receipts.length ? (
            <>
              <div className="receipts-table-wrap">
                <table className="receipts-table">
                  <thead><tr><th>Folio</th><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>Estado</th><th aria-label="Acciones" /></tr></thead>
                  <tbody>
                    {receiptsPage.items.map((receipt) => (
                      <tr key={receipt.id}>
                        <td><span className="receipt-folio">{receipt.folio}</span><small>{receipt.company}</small></td>
                        <td>{formatDate(receipt.date)}</td>
                        <td><strong>{receipt.concept}</strong></td>
                        <td><span className={receipt.type === "Ingreso" ? "receipt-type income" : "receipt-type expense"}>{receipt.type}</span></td>
                        <td className={receipt.type === "Ingreso" ? "receipt-amount income" : "receipt-amount expense"}>{money.format(receipt.amount)}</td>
                        <td><span className="receipt-status"><i />Registrado</span></td>
                        <td><ReceiptsTableActions receipt={receipt} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={receiptsPage.currentPage}
                end={receiptsPage.end}
                hrefForPage={(page) => pageHref("/receipts", resolvedSearchParams, "page", page)}
                start={receiptsPage.start}
                totalItems={receipts.length}
              />
            </>
          ) : (
            <div className="receipts-empty"><span><Icon name="receipt_long" /></span><strong>{query ? "No encontramos comprobantes" : "Aún no hay comprobantes registrados"}</strong><small>{query ? "Prueba con otro término de búsqueda." : "Los ingresos y gastos registrados aparecerán aquí como comprobantes."}</small></div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
