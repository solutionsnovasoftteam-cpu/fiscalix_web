"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

type Regime = { id: string; label: string; selectable: boolean };
type Activity = { id: string; name: string; description: string | null; requiresReview: boolean };
type Additional = {
  id: string;
  selected: boolean;
  reviewStatus: string | null;
  conditionAccepted: boolean;
};
type Rule = { regimen_origen_id: string; regimen_destino_id: string; resultado: string; condicion: string | null };
type Suggestion = {
  id: string;
  name: string;
  description: string | null;
  periodicity: string | null;
  required: boolean;
  decision: "pendiente" | "confirmada" | "rechazada";
};
type Configuration = {
  configured: boolean;
  primaryRegimeId: string | null;
  activitiesCatalog: Activity[];
  selectedActivities: { actividad_id: string }[];
  additionalRegimes: Additional[];
  compatibilityRules: Rule[];
  obligationSuggestions: Suggestion[];
};

function apiMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as { error?: { message?: string } };
  return record.error?.message ?? fallback;
}

export function FiscalRulesEditor({ companyId, regimes }: { companyId: string; regimes: Regime[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [activities, setActivities] = useState<string[]>([]);
  const [additionalRegimes, setAdditionalRegimes] = useState<string[]>([]);
  const [acceptedConditions, setAcceptedConditions] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Suggestion["decision"]>>({});

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/tax/configuration?companyId=${encodeURIComponent(companyId)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(apiMessage(result, "No fue posible cargar la configuración."));
      const data = result.data as Configuration;
      setConfiguration(data);
      setActivities(data.selectedActivities.map((item) => item.actividad_id));
      setAdditionalRegimes(data.additionalRegimes.filter((item) => item.selected).map((item) => item.id));
      setAcceptedConditions(data.additionalRegimes.filter((item) => item.conditionAccepted).map((item) => item.id));
      setDecisions(Object.fromEntries(data.obligationSuggestions.map((item) => [item.id, item.decision])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar la configuración.");
    } finally {
      setLoading(false);
    }
  }

  const availableRegimes = regimes.filter((regime) => regime.selectable && regime.id !== configuration?.primaryRegimeId);
  const statusByRegime = useMemo(() => new Map(
    (configuration?.additionalRegimes ?? [])
      .filter((item) => item.selected && item.reviewStatus)
      .map((item) => [item.id, item.reviewStatus]),
  ), [configuration]);

  const ruleByRegime = useMemo(() => {
    const primaryId = configuration?.primaryRegimeId;
    return new Map(availableRegimes.map((regime) => {
      const rule = (configuration?.compatibilityRules ?? []).find((item) =>
        (item.regimen_origen_id === primaryId && item.regimen_destino_id === regime.id)
        || (item.regimen_destino_id === primaryId && item.regimen_origen_id === regime.id));
      return [regime.id, rule ?? null];
    }));
  }, [availableRegimes, configuration]);

  function toggle(list: string[], id: string, setter: (value: string[]) => void) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  function toggleAdditionalRegime(regimeId: string) {
    if (additionalRegimes.includes(regimeId)) {
      setAdditionalRegimes((value) => value.filter((item) => item !== regimeId));
      setAcceptedConditions((value) => value.filter((item) => item !== regimeId));
      return;
    }
    setAdditionalRegimes((value) => [...value, regimeId]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/tax/configuration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          activityIds: activities,
          additionalRegimeIds: additionalRegimes,
          acceptedConditions,
          obligationDecisions: Object.entries(decisions).map(([suggestionId, state]) => ({ suggestionId, state })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(apiMessage(result, "No fue posible guardar la configuración."));
      setConfiguration(result.data as Configuration);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  const modal = (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) setOpen(false);
    }}>
      <section className="profile-editor fiscal-rules-modal" role="dialog" aria-modal="true" aria-labelledby="fiscal-rules-title">
        <div className="profile-editor-heading">
          <div>
            <span>PERFIL FISCAL</span>
            <h2 id="fiscal-rules-title">Actividades y obligaciones</h2>
            <p>Configura el contexto fiscal de esta empresa. Esto no realiza cálculos de impuestos.</p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={saving} onClick={() => setOpen(false)}><Icon name="close" /></button>
        </div>

        <div className="fiscal-rules-body">
          {loading && <p className="fiscal-rules-notice">Cargando configuración…</p>}
          {!loading && !configuration?.configured && (
            <p className="fiscal-rules-notice warning">Primero debes configurar el régimen fiscal principal.</p>
          )}
          {!loading && configuration && (
            <>
              <fieldset>
                <legend>1. Actividades económicas</legend>
                <p>Selecciona únicamente las actividades que realiza esta empresa. La primera se guardará como principal.</p>
                <div className="fiscal-choice-grid">
                  {configuration.activitiesCatalog.map((activity) => (
                    <label key={activity.id}>
                      <input type="checkbox" checked={activities.includes(activity.id)} onChange={() => toggle(activities, activity.id, setActivities)} />
                      <span><strong>{activity.name}</strong><small>{activity.description}</small>{activity.requiresReview && <em>Requiere revisión profesional</em>}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>2. Regímenes adicionales</legend>
                <p>Las combinaciones sin una regla aprobada se guardarán como pendientes de revisión profesional.</p>
                <div className="fiscal-choice-grid">
                  {availableRegimes.map((regime) => {
                    const rule = ruleByRegime.get(regime.id);
                    const result = rule?.resultado ?? statusByRegime.get(regime.id) ?? "revision_profesional";
                    const selected = additionalRegimes.includes(regime.id);
                    const incompatible = result === "incompatible";
                    return (
                      <div key={regime.id} className={`fiscal-regime-choice${selected ? " selected" : ""}${incompatible ? " disabled" : ""}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={incompatible}
                            onChange={() => toggleAdditionalRegime(regime.id)}
                          />
                          <span>
                            <strong>{regime.label}</strong>
                            <em>{result.replaceAll("_", " ")}</em>
                            {rule?.condicion && <small>{rule.condicion}</small>}
                          </span>
                        </label>
                        {selected && result === "condicionado" && (
                          <label className="fiscal-condition-acceptance">
                            <input
                              type="checkbox"
                              checked={acceptedConditions.includes(regime.id)}
                              onChange={() => toggle(acceptedConditions, regime.id, setAcceptedConditions)}
                            />
                            <span>Confirmo que cumplo la condición indicada</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend>3. Obligaciones sugeridas</legend>
                <p>Confirma o rechaza cada sugerencia. Si tienes dudas, mantenla pendiente.</p>
                {configuration.obligationSuggestions.length ? (
                  <div className="fiscal-obligation-list">
                    {configuration.obligationSuggestions.map((suggestion) => (
                      <article key={suggestion.id}>
                        <div><strong>{suggestion.name}</strong><small>{suggestion.description}</small><span>{suggestion.periodicity ?? "Periodicidad por definir"}</span></div>
                        <select value={decisions[suggestion.id] ?? "pendiente"} onChange={(event) => setDecisions((value) => ({ ...value, [suggestion.id]: event.target.value as Suggestion["decision"] }))}>
                          <option value="pendiente">Pendiente</option>
                          <option value="confirmada">Confirmar</option>
                          <option value="rechazada">Rechazar</option>
                        </select>
                      </article>
                    ))}
                  </div>
                ) : <p className="fiscal-rules-notice">Aún no hay obligaciones sugeridas para este régimen. Requiere revisión profesional.</p>}
              </fieldset>
            </>
          )}
          {message && <p className="profile-editor-message" role="alert">{message}</p>}
        </div>
        <div className="profile-editor-actions">
          <button type="button" disabled={saving} onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="primary-button" disabled={saving || loading || !configuration?.configured} onClick={save}>{saving ? "Guardando…" : "Guardar configuración"}</button>
        </div>
      </section>
    </div>
  );

  return (
    <>
      <section className="company-card fiscal-rules-card">
        <div>
          <Icon name="account_tree" />
          <span><strong>Actividades y compatibilidad fiscal</strong><small>Relaciona actividades, regímenes y obligaciones sugeridas.</small></span>
        </div>
        <button className="primary-button compact" type="button" onClick={() => {
          setOpen(true);
          void load();
        }}>Configurar</button>
      </section>
      {open && createPortal(modal, document.body)}
    </>
  );
}
