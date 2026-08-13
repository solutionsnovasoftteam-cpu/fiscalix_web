import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { TablePagination } from "@/components/TablePagination";
import { TableSearch } from "@/components/TableSearch";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator, resultCount } from "@/lib/i18n";
import { pageFromParam, pageHref, paginateItems, type PageSearchParams } from "@/lib/pagination";
import { matchesSearch, searchParamText } from "@/lib/tableSearch";
import {
  loadTaxEstimationHistoryForUser,
  loadTaxEstimationsForUser,
  type TaxEstimationExecutionChannel,
  type TaxEstimationHistoryItem,
} from "@/lib/taxEstimation";
import type {
  TaxEstimationCompanyResult,
  TaxEstimationWarningCode,
  TaxRegimeCalculationStatus,
} from "@/lib/taxEstimation.shared";
import {
  defaultUserPreferences,
  formatPreferenceDateTime,
  formatPreferenceMoney,
  type UserPreferences,
} from "@/lib/userPreferences.shared";

function moneyOrDash(value: number | null, preferences: UserPreferences) {
  return value === null ? "—" : formatPreferenceMoney(value, preferences);
}

function rateLabel(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(2)}%`;
}

type Translator = ReturnType<typeof createTranslator>;

function channelLabel(channel: TaxEstimationExecutionChannel | string, t: Translator) {
  if (channel === "mobile") return t("taxes.channelMobile");
  if (channel === "api") return t("taxes.channelApi");
  return t("taxes.channelWeb");
}

function executionShortId(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "—";
}

function warningLabel(code: TaxEstimationWarningCode | undefined, t: Translator) {
  if (code === "MISSING_FISCAL_PROFILE") return t("taxes.profileMissing");
  if (code === "INACTIVE_FISCAL_PROFILE") return t("taxes.inactiveProfile");
  if (code === "REGIME_NOT_ENABLED_STAGE_8") return t("taxes.regimeValidationOnly");
  if (code === "UNSUPPORTED_REGIME") return t("taxes.unsupportedRegime");
  if (code === "RESICO_LIMIT_EXCEEDED") return t("taxes.resicoLimitExceeded");
  return t("taxes.estimateUnavailable");
}

function regimeStatusLabel(status: TaxRegimeCalculationStatus, t: Translator) {
  if (status === "enabled") return t("taxes.regimeEnabled");
  if (status === "validation_only") return t("taxes.regimeValidationOnly");
  return t("taxes.regimePlanned");
}

function rowSearchFields(
  row: TaxEstimationCompanyResult,
  preferences: UserPreferences,
  t: Translator,
) {
  return [
    row.companyName,
    row.regimeSatCode,
    row.regimeKey,
    row.regimeStatus,
    row.regimeName,
    row.validationMessages.join(" "),
    row.incomes,
    row.expenses,
    row.base,
    row.vatEstimated ?? "",
    row.isrEstimated ?? "",
    row.taxEstimated ?? "",
    formatPreferenceMoney(row.incomes, preferences),
    formatPreferenceMoney(row.expenses, preferences),
    formatPreferenceMoney(row.base, preferences),
    moneyOrDash(row.taxEstimated, preferences),
    row.estimationAvailable ? t("taxes.estimateReady") : warningLabel(row.warnings[0], t),
  ];
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
  const query = searchParamText(resolvedSearchParams, "q");
  const requestedCompanyId = searchParamText(resolvedSearchParams, "companyId") || null;
  const requestedPeriod = searchParamText(resolvedSearchParams, "period") || null;

  const estimationResult = await loadTaxEstimationsForUser(user, {
    channel: "web",
    companyId: requestedCompanyId,
    period: requestedPeriod,
  });
  const historyResult = await loadTaxEstimationHistoryForUser(user, { limit: 8 });
  const estimation = estimationResult.data;
  const historyRows: TaxEstimationHistoryItem[] = Array.isArray(historyResult.data) ? historyResult.data : [];
  const regimeCatalog = estimation?.regimeCatalog ?? [];
  const period = estimation?.period ?? estimationResult.period;
  const rows = estimation?.companies ?? [];
  const totals = estimation?.totals ?? {
    base: 0,
    companies: 0,
    companiesWithEstimate: 0,
    deductibleExpenses: 0,
    expenses: 0,
    incomes: 0,
    isrEstimated: 0,
    taxEstimated: 0,
    vatEstimated: 0,
  };
  const filteredRows = rows.filter((row) => matchesSearch(rowSearchFields(row, preferences, t), query));
  const estimatePage = paginateItems(filteredRows, pageFromParam(resolvedSearchParams.page));
  const hasError = Boolean(estimationResult.error);

  return (
    <AppShell activeHref="/taxes" user={user}>
      <main className="reports-content">
        <header className="reports-header tax-estimation-header">
          <div>
            <p>{t("taxes.eyebrow")}</p>
            <h1>{t("taxes.title")}</h1>
            <span>{t("taxes.description")}</span>
          </div>
          <form className="tax-estimation-form">
            <label>
              {t("taxes.period")}
              <input defaultValue={period.key} name="period" type="month" />
            </label>
            <label>
              {t("taxes.companyFilter")}
              <select defaultValue={estimationResult.selectedCompanyId ?? ""} name="companyId">
                <option value="">{t("taxes.allCompanies")}</option>
                {estimationResult.companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </label>
            <button className="primary-button compact" type="submit">{t("taxes.updateEstimate")}</button>
          </form>
        </header>

        {hasError && (
          <section className="dashboard-alert" role="alert">
            <strong>{t("taxes.loadError")}</strong>
            <span>{estimationResult.error ?? t("taxes.loadErrorHelp")}</span>
          </section>
        )}

        {estimationResult.traceError && (
          <section className="dashboard-alert" role="status">
            <strong>{t("taxes.tracePendingTitle")}</strong>
            <span>{estimationResult.traceError}</span>
          </section>
        )}

        <section className="tax-estimation-notice">
          <span><Icon name="info" /></span>
          <div>
            <strong>{t("taxes.estimatedNoticeTitle")}</strong>
            <small>{t("taxes.estimatedNoticeHelp")}</small>
          </div>
        </section>

        <section className="reports-stats">
          <article><span><Icon name="event_note" /></span><small>{t("taxes.period")}</small><strong>{period.label}</strong></article>
          <article><span><Icon name="attach_money" /></span><small>{t("taxes.incomeCollected")}</small><strong>{money(totals.incomes)}</strong></article>
          <article><span><Icon name="calculate" /></span><small>{t("taxes.resicoBase")}</small><strong>{money(totals.base)}</strong></article>
          <article><span><Icon name="percent" /></span><small>{t("taxes.estimatedTaxTotal")}</small><strong>{money(totals.taxEstimated)}</strong></article>
        </section>

        <section className="reports-card tax-formula-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.formulaTitle")}</h2>
              <p>{t("taxes.formulaHelp")}</p>
            </div>
            <span>{t("taxes.resicoCompanies", { count: totals.companiesWithEstimate })}</span>
          </div>
          <div className="tax-formula-list">
            <p><strong>{t("taxes.isrFormula")}</strong><span>{t("taxes.isrFormulaHelp")}</span></p>
            <p><strong>{t("taxes.ivaFormula")}</strong><span>{t("taxes.ivaFormulaHelp")}</span></p>
            <p><strong>{t("taxes.ruleVersion")}</strong><span>{estimation?.ruleVersion.code ?? "—"} · v{estimation?.ruleVersion.version ?? "—"}</span></p>
            <p>
              <strong>{t("taxes.traceExecution")}</strong>
              <span>{estimationResult.traceId ? t("taxes.traceSaved", { id: executionShortId(estimationResult.traceId) }) : t("taxes.tracePending")}</span>
            </p>
            <p><strong>{t("taxes.generatedAt")}</strong><span>{formatPreferenceDateTime(estimation?.generatedAt, preferences, t("common.pending"))}</span></p>
          </div>
        </section>

        <section className="reports-card tax-regime-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.regimeCoverageTitle")}</h2>
              <p>{t("taxes.regimeCoverageHelp")}</p>
            </div>
            <span>{t("taxes.enabledRegimeCount", { count: regimeCatalog.filter((rule) => rule.enabled).length })}</span>
          </div>
          <div className="reports-table-scroll">
            <table className="reports-table tax-regime-table">
              <thead>
                <tr>
                  <th>{t("taxes.regime")}</th>
                  <th>{t("taxes.satCodes")}</th>
                  <th>{t("table.status")}</th>
                  <th>{t("taxes.requiredData")}</th>
                </tr>
              </thead>
              <tbody>
                {regimeCatalog.map((rule) => (
                  <tr key={rule.key}>
                    <td>
                      <strong>{rule.order}. {rule.name}</strong>
                      <small>{rule.description}</small>
                    </td>
                    <td>{rule.satCodes.join(", ")}</td>
                    <td>
                      <span className={rule.enabled ? "admin-status" : "admin-status suspended"}>
                        {regimeStatusLabel(rule.status, t)}
                      </span>
                      <small>{rule.ruleVersion.code}</small>
                    </td>
                    <td><small>{rule.requiredData.slice(0, 3).join(" · ")}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="reports-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.estimationByCompany")}</h2>
              <p>{t("taxes.estimationByCompanyHelp")}</p>
            </div>
            <div className="table-card-actions">
              <TableSearch
                label={t("taxes.searchEstimateLabel")}
                language={preferences.language}
                name="q"
                pathname="/taxes"
                placeholder={t("taxes.searchEstimatePlaceholder")}
                resetPageKeys={["page"]}
                searchParams={resolvedSearchParams}
              />
              <span>{resultCount(filteredRows.length, preferences.language)}</span>
            </div>
          </div>

          {filteredRows.length ? (
            <>
              <div className="reports-table-scroll">
                <table className="reports-table tax-estimation-table">
                  <thead>
                    <tr>
                      <th>{t("table.company")}</th>
                      <th>{t("taxes.regime")}</th>
                      <th>{t("taxes.incomeCollected")}</th>
                      <th>{t("taxes.expensesPaid")}</th>
                      <th>{t("taxes.resicoBase")}</th>
                      <th>{t("taxes.estimatedIvaPayable")}</th>
                      <th>{t("taxes.estimatedIsrPayable")}</th>
                      <th>{t("taxes.estimatedAmount")}</th>
                      <th>{t("table.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimatePage.items.map((row) => (
                      <tr key={row.companyId}>
                        <td>
                          <strong>{row.companyName}</strong>
                          <small>{t("taxes.movementCounts", { expenses: row.expenseCount, incomes: row.incomeCount })}</small>
                        </td>
                        <td>
                          {row.regimeSatCode ? `${row.regimeSatCode} · ${row.regimeName ?? t("taxes.taxToDetermine")}` : "—"}
                          <small>{rateLabel(row.isrRate)}</small>
                        </td>
                        <td>{money(row.incomes)}</td>
                        <td>
                          {money(row.expenses)}
                          <small>{t("taxes.deductibleExpenseBase")}: {money(row.deductibleExpenses)}</small>
                        </td>
                        <td>{money(row.base)}</td>
                        <td>
                          {moneyOrDash(row.vatEstimated, preferences)}
                          <small>{money(row.vatTransferred)} - {money(row.vatCreditable)}</small>
                        </td>
                        <td>
                          {moneyOrDash(row.isrEstimated, preferences)}
                          <small>{t("taxes.withheldIsr")}: {money(row.isrWithheld)}</small>
                        </td>
                        <td><strong>{moneyOrDash(row.taxEstimated, preferences)}</strong></td>
                        <td>
                          <span className={row.estimationAvailable ? "admin-status" : "admin-status suspended"}>
                            {row.estimationAvailable ? t("taxes.estimateReady") : warningLabel(row.warnings[0], t)}
                          </span>
                          {row.validationMessages[0] && (
                            <small>{row.validationMessages[0]}</small>
                          )}
                          {row.excludedMovementCount > 0 && (
                            <small>{t("taxes.excludedMovements", { count: row.excludedMovementCount })}</small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                currentPage={estimatePage.currentPage}
                end={estimatePage.end}
                hrefForPage={(page) => pageHref("/taxes", resolvedSearchParams, "page", page)}
                language={preferences.language}
                start={estimatePage.start}
                totalItems={filteredRows.length}
              />
            </>
          ) : (
            <div className="reports-empty">
              <span><Icon name="calculate" /></span>
              <strong>{query ? t("taxes.noEstimatesSearch") : t("taxes.noEstimates")}</strong>
              <small>{query ? t("common.tryAnotherSearch") : t("taxes.noEstimatesHelp")}</small>
            </div>
          )}
        </section>

        <section className="reports-card tax-history-card">
          <div className="reports-card-heading">
            <div>
              <h2>{t("taxes.historyTitle")}</h2>
              <p>{t("taxes.historyHelp")}</p>
            </div>
            <span>{resultCount(historyRows.length, preferences.language)}</span>
          </div>

          {historyResult.error ? (
            <div className="reports-empty">
              <span><Icon name="info" /></span>
              <strong>{t("taxes.historyUnavailable")}</strong>
              <small>{historyResult.error}</small>
            </div>
          ) : historyRows.length ? (
            <div className="reports-table-scroll">
              <table className="reports-table tax-history-table">
                <thead>
                  <tr>
                    <th>{t("taxes.execution")}</th>
                    <th>{t("taxes.period")}</th>
                    <th>{t("taxes.incomeCollected")}</th>
                    <th>{t("taxes.resicoBase")}</th>
                    <th>{t("taxes.estimatedIvaPayable")}</th>
                    <th>{t("taxes.estimatedIsrPayable")}</th>
                    <th>{t("taxes.estimatedAmount")}</th>
                    <th>{t("taxes.movementsAudited")}</th>
                    <th>{t("taxes.channel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{formatPreferenceDateTime(row.createdAt, preferences, t("common.pending"))}</strong>
                        <small>{executionShortId(row.id)}</small>
                      </td>
                      <td>{row.periodKey}</td>
                      <td>{money(row.income)}</td>
                      <td>{money(row.base)}</td>
                      <td>{money(row.vatEstimated)}</td>
                      <td>{money(row.isrEstimated)}</td>
                      <td><strong>{money(row.taxEstimated)}</strong></td>
                      <td>{row.movementCount}</td>
                      <td><span className="admin-status">{channelLabel(row.channel, t)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reports-empty">
              <span><Icon name="event_note" /></span>
              <strong>{t("taxes.noHistory")}</strong>
              <small>{t("taxes.noHistoryHelp")}</small>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
