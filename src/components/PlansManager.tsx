"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { mergePlansWithDbRows, planMonthlyAmount, type FiscalixPlan, type PlanDbRow } from "@/lib/plans";
import { useModal } from "@/lib/useModal";

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
  initialPlans,
  initialStatus = "",
}: {
  canManagePlans: boolean;
  initialPlans: FiscalixPlan[];
  initialStatus?: string;
}) {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [plans, setPlans] = useState(initialPlans);
  const [savedMessage, setSavedMessage] = useState(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeEditor = useCallback(() => setDraft(null), []);
  useModal({ busy: isSaving, dialogRef, onClose: closeEditor, open: draft !== null });

  const featuredPlan = useMemo(() => plans.find((plan) => plan.id === "plus") ?? plans[2], [plans]);

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
      setSavedMessage("Ingresa un precio mensual válido.");
      return;
    }

    const annualAmount = textToNumber(draft.annualAmountText);
    if (annualAmount !== null && annualAmount < 0) {
      setSavedMessage("Ingresa un precio anual válido.");
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
      if (!response.ok || !result.plan) throw new Error(result.message ?? "No fue posible guardar el plan.");

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
      setSavedMessage("Plan guardado en Supabase.");
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : "No fue posible guardar el plan.");
    } finally {
      setIsSaving(false);
    }
  }

  function resetPlans() {
    window.location.reload();
  }

  return (
    <main className="plans-content">
      <header className="plans-header">
        <div>
          <p>PLANES COMERCIALES</p>
          <h1>Planes para usuarios finales</h1>
          <span>Consulta, compara y edita la oferta comercial de Fiscalix.</span>
        </div>
        <button className="plans-reset-button" type="button" onClick={resetPlans}>
          Recargar desde Supabase
        </button>
      </header>

      {savedMessage && <div className="plans-message" role="status">{savedMessage}</div>}

      <section className="plans-overview">
        <article>
          <span><Icon name="payments" /></span>
          <small>Plan destacado</small>
          <strong>{featuredPlan?.name}</strong>
          <p>{featuredPlan?.monthlyPrice} al mes</p>
        </article>
        <article>
          <span><Icon name="business" /></span>
          <small>Catálogo conectado</small>
          <strong>{plans.filter((plan) => plan.source === "database").length} en Supabase</strong>
          <p>Tabla planes; suscripciones asigna planes a empresas</p>
        </article>
        <article>
          <span><Icon name="edit" /></span>
          <small>{canManagePlans ? "Edición completa" : "Consulta disponible"}</small>
          <strong>{canManagePlans ? "Oferta comercial" : "Planes comerciales"}</strong>
          <p>{canManagePlans ? "Guarda precios, límites, beneficios y mensajes" : "Tu rol actual no puede modificar precios ni beneficios"}</p>
        </article>
      </section>

      <section className="plans-grid">
        {plans.map((plan) => (
          <article className={plan.id === "plus" ? "plan-card featured" : "plan-card"} key={plan.id}>
            <div className="plan-card-top">
              <span>{plan.badge}</span>
              {canManagePlans && (
                <button type="button" onClick={() => editPlan(plan)}><Icon name="edit" /> Editar</button>
              )}
            </div>
            <h2>{plan.name}</h2>
            <p>{plan.description}</p>
            <div className="plan-db-limits">
              <span>{plan.databaseId ? "Supabase" : "Base pendiente"}</span>
              <b>{plan.companyLimit ?? "—"} empresa(s)</b>
              <b>{plan.userLimit ?? "—"} usuario(s)</b>
            </div>
            <div className="plan-price">
              <strong>{plan.monthlyPrice}</strong>
              <small>Mensual</small>
            </div>
            <div className="plan-annual">
              <span>{plan.annualPrice}</span>
              <small>Anual sugerido</small>
            </div>
            <div className="plan-section">
              <h3>Incluye</h3>
              <ul>
                {plan.includes.map((item) => (
                  <li key={item}><Icon name="check" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="plan-section muted">
              <h3>Límites sugeridos</h3>
              <ul>
                {plan.limits.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <footer>{plan.objective}</footer>
          </article>
        ))}
      </section>

      {draft && (
        <section className="plans-editor" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) closeEditor(); }}>
          <div aria-labelledby="plan-editor-title" aria-modal="true" className="plans-editor-card" ref={dialogRef} role="dialog" tabIndex={-1}>
            <div className="plans-editor-heading">
              <div>
                <p>EDITANDO PLAN</p>
                <h2 id="plan-editor-title">{draft.name}</h2>
                <span>Estos cambios se guardan en la tabla planes de Supabase.</span>
              </div>
              <button aria-label="Cerrar editor" disabled={isSaving} type="button" onClick={closeEditor}>×</button>
            </div>

            <div className="plans-editor-grid">
              <label>
                Nombre del plan
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} />
              </label>
              <label>
                Precio mensual
                <input inputMode="decimal" value={draft.monthlyAmountText} onChange={(event) => updateDraft("monthlyAmountText", event.target.value)} />
              </label>
              <label>
                Precio anual
                <input inputMode="decimal" value={draft.annualAmountText} onChange={(event) => updateDraft("annualAmountText", event.target.value)} />
              </label>
              <label>
                Empresas incluidas
                <input inputMode="numeric" value={draft.companyLimitText} onChange={(event) => updateDraft("companyLimitText", event.target.value)} />
              </label>
              <label>
                Usuarios incluidos
                <input inputMode="numeric" value={draft.userLimitText} onChange={(event) => updateDraft("userLimitText", event.target.value)} />
              </label>
              <label>
                Orden
                <input inputMode="numeric" value={draft.orderText} onChange={(event) => updateDraft("orderText", event.target.value)} />
              </label>
              <label>
                Badge
                <input value={draft.badge} onChange={(event) => updateDraft("badge", event.target.value)} />
              </label>
              <label className="wide">
                Estado
                <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value)}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
              <label className="wide">
                Descripción
                <textarea rows={3} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} />
              </label>
              <label className="wide">
                Objetivo comercial
                <textarea rows={3} value={draft.objective} onChange={(event) => updateDraft("objective", event.target.value)} />
              </label>
              <label className="wide">
                Qué incluye
                <textarea rows={8} value={draft.includesText} onChange={(event) => updateDraft("includesText", event.target.value)} />
                <small>Escribe un beneficio por línea.</small>
              </label>
              <label className="wide">
                Limitaciones
                <textarea rows={7} value={draft.limitsText} onChange={(event) => updateDraft("limitsText", event.target.value)} />
                <small>Escribe una limitación por línea.</small>
              </label>
              <p className="plans-editor-note">
                Estos campos se guardan directamente en Supabase. Los beneficios y limitaciones se almacenan como JSON para que después puedan reutilizarse en checkout, landing o administración.
              </p>
            </div>

            <div className="plans-editor-actions">
              <button type="button" disabled={isSaving} onClick={closeEditor}>Cancelar</button>
              <button className="primary-button compact" type="button" onClick={savePlan} disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar en Supabase"}
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
