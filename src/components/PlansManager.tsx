"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import { mergePlansWithDbRows, planMonthlyAmount, type FiscalixPlan, type PlanDbRow } from "@/lib/plans";
import { useModal } from "@/lib/useModal";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

type PlanDraft = {
  annualAmountText: string;
  badge: string;
  companyLimitText: string;
  databaseId?: string;
  description: string;
  id: string;
  includesText: string;
  limitsText: string;
  monthlyAmountText: string;
  name: string;
  objective: string;
  orderText: string;
  status: string;
  userLimitText: string;
};

function toDraft(plan: FiscalixPlan): PlanDraft {
  return {
    annualAmountText: plan.annualAmount?.toString() ?? "",
    badge: plan.badge,
    companyLimitText: plan.companyLimit?.toString() ?? "",
    databaseId: plan.databaseId,
    description: plan.description,
    id: plan.id,
    includesText: plan.includes.join("\n"),
    limitsText: plan.limits.join("\n"),
    monthlyAmountText: String(planMonthlyAmount(plan)),
    name: plan.name,
    objective: plan.objective,
    orderText: plan.order?.toString() ?? "",
    status: plan.status ?? "activo",
    userLimitText: plan.userLimit?.toString() ?? "",
  };
}

function textToNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textToList(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function PlansManager({
  canManagePlans,
  canSubscribePlans,
  currentPlanDatabaseId,
  initialPlans,
  initialStatus = "",
  language = "es",
}: {
  canManagePlans: boolean;
  canSubscribePlans: boolean;
  currentPlanDatabaseId?: string | null;
  initialPlans: FiscalixPlan[];
  initialStatus?: string;
  language?: FiscalixLanguage;
}) {
  const t = createTranslator(language);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [activePlanDatabaseId, setActivePlanDatabaseId] = useState(currentPlanDatabaseId ?? null);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeEditor = useCallback(() => setDraft(null), [setDraft]);
  useModal({ busy: isSaving, dialogRef, onClose: closeEditor, open: draft !== null });

  const featuredPlan = useMemo(() => plans.find((plan) => plan.id === "plus") ?? plans[2], [plans]);
  const headerEyebrow = canManagePlans ? t("plans.adminEyebrow") : t("plans.clientEyebrow");
  const headerTitle = canManagePlans ? t("plans.adminTitle") : t("plans.clientTitle");
  const headerDescription = canManagePlans
    ? t("plans.adminDescription")
    : t("plans.clientDescription");

  function editPlan(plan: FiscalixPlan) {
    if (!canManagePlans) return;
    setSavedMessage("");
    setDraft(toDraft(plan));
  }

  function updateDraft(field: keyof PlanDraft, value: string) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  }

  async function savePlan() {
    if (!draft) return;
    const monthlyAmount = textToNumber(draft.monthlyAmountText);
    if (monthlyAmount === null || monthlyAmount < 0) {
      setSavedMessage(t("plans.invalidMonthly"));
      return;
    }

    const annualAmount = textToNumber(draft.annualAmountText);
    if (annualAmount !== null && annualAmount < 0) {
      setSavedMessage(t("plans.invalidAnnual"));
      return;
    }

    setIsSaving(true);
    setSavedMessage("");

    try {
      const response = await fetch("/api/plans", {
        body: JSON.stringify({
          annualAmount,
          badge: draft.badge,
          companyLimit: textToNumber(draft.companyLimitText),
          databaseId: draft.databaseId,
          description: draft.description,
          includes: textToList(draft.includesText),
          limits: textToList(draft.limitsText),
          monthlyAmount,
          name: draft.name,
          objective: draft.objective,
          order: textToNumber(draft.orderText),
          status: draft.status,
          userLimit: textToNumber(draft.userLimitText),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string; plan?: PlanDbRow };
      if (!response.ok || !result.plan) throw new Error(result.message ?? t("plans.saveError"));

      const mergedPlan = mergePlansWithDbRows([result.plan]).find((plan) => plan.databaseId === result.plan?.id);
      setPlans((current) => current.map((plan) => {
        if (plan.id !== draft.id) return plan;
        return {
          ...plan,
          ...mergedPlan,
          id: plan.id,
        };
      }));
      setDraft(null);
      setSavedMessage(t("plans.saved"));
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : t("plans.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  function resetPlans() {
    window.location.reload();
  }

  async function subscribeToPlan(plan: FiscalixPlan) {
    if (!canSubscribePlans) return;
    if (!plan.databaseId) {
      setSavedMessage(t("plans.missingDb"));
      return;
    }

    setSubscribingPlanId(plan.databaseId);
    setSavedMessage("");

    try {
      const response = await fetch("/api/subscriptions", {
        body: JSON.stringify({ planId: plan.databaseId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = (await response.json()) as {
        message?: string;
        subscription?: { plan_id?: string | null };
      };

      if (!response.ok) throw new Error(result.message ?? t("plans.subscribeError"));

      setActivePlanDatabaseId(result.subscription?.plan_id ?? plan.databaseId);
      setSavedMessage(result.message ?? t("plans.subscribed", { plan: plan.name }));
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : t("plans.subscribeError"));
    } finally {
      setSubscribingPlanId(null);
    }
  }

  return (
    <main className="plans-content">
      <header className="plans-header">
        <div>
          <p>{headerEyebrow}</p>
          <h1>{headerTitle}</h1>
          <span>{headerDescription}</span>
        </div>
        {!canSubscribePlans ? (
          <button className="plans-reset-button" type="button" onClick={resetPlans}>
            {t("plans.reload")}
          </button>
        ) : null}
      </header>

      {savedMessage && <div className="plans-message" role="status">{savedMessage}</div>}

      {!canSubscribePlans ? (
        <section className="plans-overview">
          <article>
            <span><Icon name="payments" /></span>
            <small>{t("plans.featured")}</small>
            <strong>{featuredPlan?.name}</strong>
            <p>{featuredPlan?.monthlyPrice} {t("plans.monthlySuffix")}</p>
          </article>
          <article>
            <span><Icon name="business" /></span>
            <small>{t("plans.catalogConnected")}</small>
            <strong>{t("plans.inSupabase", { count: plans.filter((plan) => plan.source === "database").length })}</strong>
            <p>{t("plans.catalogHelp")}</p>
          </article>
          <article>
            <span><Icon name="edit" /></span>
            <small>{canManagePlans ? t("plans.fullEdit") : t("plans.readOnly")}</small>
            <strong>{canManagePlans ? t("plans.commercialOffer") : t("plans.commercialPlans")}</strong>
            <p>{canManagePlans ? t("plans.editHelp") : t("plans.readOnlyHelp")}</p>
          </article>
        </section>
      ) : null}

      <section className="plans-grid">
        {plans.map((plan) => {
          const isCurrentPlan = Boolean(plan.databaseId && plan.databaseId === activePlanDatabaseId);
          const isSubscribing = subscribingPlanId === plan.databaseId;

          return (
            <article className={plan.id === "plus" ? "plan-card featured" : "plan-card"} key={plan.id}>
              <div className="plan-card-top">
                <span>{plan.badge}</span>
                {canManagePlans && (
                  <button type="button" onClick={() => editPlan(plan)}><Icon name="edit" /> {t("plans.edit")}</button>
                )}
              </div>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
              <div className="plan-db-limits">
                <span>{plan.databaseId ? "Supabase" : t("plans.basePending")}</span>
                <b>{plan.companyLimit == null ? "—" : t("plans.companyCount", { count: plan.companyLimit })}</b>
                <b>{plan.userLimit == null ? "—" : t("plans.userCount", { count: plan.userLimit })}</b>
              </div>
              <div className="plan-price">
                <strong>{plan.monthlyPrice}</strong>
                <small>{t("plans.monthly")}</small>
              </div>
              <div className="plan-annual">
                <span>{plan.annualPrice}</span>
                <small>{t("plans.annualSuggested")}</small>
              </div>
              <div className="plan-section">
                <h3>{t("plans.includes")}</h3>
                <ul>
                  {plan.includes.map((item) => (
                    <li key={item}><Icon name="check" />{item}</li>
                  ))}
                </ul>
              </div>
              <footer>{plan.objective}</footer>
              {canSubscribePlans ? (
                <button
                  className={isCurrentPlan ? "plan-subscribe-button current" : "plan-subscribe-button"}
                  disabled={isSubscribing || isCurrentPlan || !plan.databaseId}
                  onClick={() => subscribeToPlan(plan)}
                  type="button"
                >
                  <Icon name={isCurrentPlan ? "check_circle" : "payments"} />
                  {isCurrentPlan ? t("plans.current") : isSubscribing ? t("plans.subscribing") : t("plans.subscribe")}
                </button>
              ) : null}
            </article>
          );
        })}
      </section>

      {draft && (
        <section className="plans-editor" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) closeEditor(); }}>
          <div aria-labelledby="plan-editor-title" aria-modal="true" className="plans-editor-card" ref={dialogRef} role="dialog" tabIndex={-1}>
            <div className="plans-editor-heading">
              <div>
                <p>{t("plans.editing")}</p>
                <h2 id="plan-editor-title">{draft.name}</h2>
                <span>{t("plans.editorHelp")}</span>
              </div>
              <button aria-label={t("button.close")} disabled={isSaving} type="button" onClick={closeEditor}>×</button>
            </div>

            <div className="plans-editor-grid">
              <label>
                {t("plans.name")}
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
              </label>
              <label>
                {t("plans.monthlyPrice")}
                <input inputMode="decimal" value={draft.monthlyAmountText} onChange={(event) => updateDraft("monthlyAmountText", event.target.value)} />
              </label>
              <label>
                {t("plans.annualPrice")}
                <input inputMode="decimal" value={draft.annualAmountText} onChange={(event) => updateDraft("annualAmountText", event.target.value)} />
              </label>
              <label>
                {t("plans.includedCompanies")}
                <input inputMode="numeric" value={draft.companyLimitText} onChange={(event) => updateDraft("companyLimitText", event.target.value)} />
              </label>
              <label>
                {t("plans.includedUsers")}
                <input inputMode="numeric" value={draft.userLimitText} onChange={(event) => updateDraft("userLimitText", event.target.value)} />
              </label>
              <label>
                {t("plans.order")}
                <input inputMode="numeric" value={draft.orderText} onChange={(event) => updateDraft("orderText", event.target.value)} />
              </label>
              <label>
                {t("plans.badge")}
                <input value={draft.badge} onChange={(event) => updateDraft("badge", event.target.value)} />
              </label>
              <label className="wide">
                {t("plans.status")}
                <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}>
                  <option value="activo">{t("common.active")}</option>
                  <option value="inactivo">{t("common.inactive")}</option>
                </select>
              </label>
              <label className="wide">
                {t("plans.description")}
                <textarea rows={3} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
              </label>
              <label className="wide">
                {t("plans.objective")}
                <textarea rows={3} value={draft.objective} onChange={(event) => updateDraft("objective", event.target.value)} />
              </label>
              <label className="wide">
                {t("plans.whatIncludes")}
                <textarea rows={8} value={draft.includesText} onChange={(event) => updateDraft("includesText", event.target.value)} />
                <small>{t("plans.oneBenefitLine")}</small>
              </label>
              <label className="wide">
                {t("plans.limitations")}
                <textarea rows={7} value={draft.limitsText} onChange={(event) => updateDraft("limitsText", event.target.value)} />
                <small>{t("plans.oneLimitLine")}</small>
              </label>
              <p className="plans-editor-note">
                {t("plans.editorNote")}
              </p>
            </div>

            <div className="plans-editor-actions">
              <button type="button" disabled={isSaving} onClick={closeEditor}>{t("button.cancel")}</button>
              <button className="primary-button compact" type="button" onClick={savePlan} disabled={isSaving}>
                {isSaving ? t("common.saving") : t("plans.saveSupabase")}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
