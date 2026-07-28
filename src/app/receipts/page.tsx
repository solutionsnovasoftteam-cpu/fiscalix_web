import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { ReceiptsTableActions } from "@/app/receipts/receipts-table-actions";
import { getAccessibleCompanies, isMissingColumnError } from "@/lib/access-control";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { supabase } from "@/lib/supabase";
import {
  defaultUserPreferences,
  formatPreferenceDate,
  formatPreferenceMoney,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

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

function amount(value: number | string | null) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string, preferences: UserPreferences) {
  return formatPreferenceDate(value, preferences, value);
}

export default async function ReceiptsPage({
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
  const q = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const query = q.trim().toLowerCase();
  const { companies, error: companiesError } = await getAccessibleCompanies(user);

  const companyIds = [...new Set(companies.map((company) => company.id))];
  const companyNameById = new Map(companies.map((company) => [company.id, company.nombre_comercial || t("common.noCompany")]));
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
      company: companyNameById.get(record.empresa_id ?? "") ?? t("common.noCompany"),
      concept: record.concepto || (type === "Ingreso" ? t("receipts.incomeNoDescription") : t("receipts.expenseNoDescription")),
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
            <div><p>{t("receipts.eyebrow")}</p><h1>{t("receipts.title")}</h1><span>{t("receipts.description")}</span></div>
          </div>
          <button className="receipts-new" type="button"><Icon name="add" /> {t("receipts.new")}</button>
        </section>

        <section className="receipts-summary" aria-label={t("receipts.summary")}>
          <article><span><Icon name="receipt_long" /></span><div><small>{t("receipts.count")}</small><strong>{allReceipts.length}</strong></div></article>
          <article><span><Icon name="trending_up" /></span><div><small>{t("receipts.incomeBacked")}</small><strong>{money(incomes.reduce((sum, receipt) => sum + receipt.amount, 0))}</strong></div></article>
          <article><span><Icon name="trending_down" /></span><div><small>{t("receipts.expensesBacked")}</small><strong>{money(expenses.reduce((sum, receipt) => sum + receipt.amount, 0))}</strong></div></article>
        </section>

        {hasError && <section className="receipts-alert" role="alert"><Icon name="help" /> {t("receipts.loadError")}</section>}

        <section className="receipts-card">
          <div className="receipts-card-top">
            <TableSearch
              label={t("receipts.searchLabel")}
              language={preferences.language}
              pathname="/receipts"
              placeholder={t("receipts.searchPlaceholder")}
              searchParams={resolvedSearchParams}
            />
            <span className="receipts-count">{resultCount(receipts.length, preferences.language)}</span>
          </div>

          {receipts.length ? (
            <>
              <div className="receipts-table-wrap">
                <table className="receipts-table">
                  <thead><tr><th>{t("table.folio")}</th><th>{t("table.date")}</th><th>{t("table.concept")}</th><th>{t("table.type")}</th><th>{t("table.amount")}</th><th>{t("table.status")}</th><th aria-label={t("table.actions")} /></tr></thead>
                  <tbody>
                    {receiptsPage.items.map((receipt) => (
                      <tr key={receipt.id}>
                        <td><span className="receipt-folio">{receipt.folio}</span><small>{receipt.company}</small></td>
                        <td>{formatDate(receipt.date, preferences)}</td>
                        <td><strong>{receipt.concept}</strong></td>
                        <td><span className={receipt.type === "Ingreso" ? "receipt-type income" : "receipt-type expense"}>{receipt.type === "Ingreso" ? t("dashboard.income") : t("dashboard.expenses")}</span></td>
                        <td className={receipt.type === "Ingreso" ? "receipt-amount income" : "receipt-amount expense"}>{money(receipt.amount)}</td>
                        <td><span className="receipt-status"><i />{t("common.registered")}</span></td>
                        <td><ReceiptsTableActions preferences={preferences} receipt={receipt} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={receiptsPage.currentPage}
                end={receiptsPage.end}
                hrefForPage={(page) => pageHref("/receipts", resolvedSearchParams, "page", page)}
                language={preferences.language}
                start={receiptsPage.start}
                totalItems={receipts.length}
              />
            </>
          ) : (
            <div className="receipts-empty"><span><Icon name="receipt_long" /></span><strong>{query ? t("receipts.noSearch") : t("receipts.empty")}</strong><small>{query ? t("common.tryAnotherSearch") : t("receipts.emptyHelp")}</small></div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
