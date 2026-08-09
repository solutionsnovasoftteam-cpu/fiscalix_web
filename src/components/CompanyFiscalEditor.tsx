"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";
import { useModal } from "@/lib/useModal";

type Regime = {
  clave: string;
  description: string;
  id: string;
  nombre: string;
  selectable: boolean;
  validFrom: string;
  validUntil: string;
};
type CompanyEditorData = {
  address: string;
  email: string;
  id: string;
  legalName: string;
  nombre: string;
  phone: string;
  fiscalConfigured: boolean;
  fiscalEndDate: string;
  fiscalPeriodicity: string;
  fiscalStartDate: string;
  regimeId: string;
  rfc: string;
};
type CompanyDraft = Pick<CompanyEditorData, "fiscalEndDate" | "fiscalPeriodicity" | "fiscalStartDate" | "nombre" | "regimeId" | "rfc">;

type ApiResult = { error?: { message?: string }; message?: string };

function resultMessage(result: ApiResult, fallback: string) {
  return result.error?.message ?? result.message ?? fallback;
}

export function CompanyFiscalEditor({ company, language = "es", regimes }: {
  company: CompanyEditorData | null;
  language?: FiscalixLanguage;
  regimes: Regime[];
}) {
  const router = useRouter();
  const t = createTranslator(language);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<CompanyDraft>({
    fiscalEndDate: company?.fiscalEndDate ?? "",
    fiscalPeriodicity: company?.fiscalPeriodicity ?? "mensual",
    fiscalStartDate: company?.fiscalStartDate ?? "",
    nombre: company?.nombre ?? "",
    regimeId: company?.regimeId ?? "",
    rfc: company?.rfc ?? "",
  });
  const close = useCallback(() => setOpen(false), [setOpen]);
  useModal({ busy, dialogRef, onClose: close, open });

  if (!company) return null;
  const companyData = company;
  const selectedRegime = regimes.find((regime) => regime.id === draft.regimeId);
  const periodicityKeys = {
    anual: "company.periodicity.anual",
    bimestral: "company.periodicity.bimestral",
    mensual: "company.periodicity.mensual",
    semestral: "company.periodicity.semestral",
    trimestral: "company.periodicity.trimestral",
  } as const;
  const periodicityKey = periodicityKeys[draft.fiscalPeriodicity as keyof typeof periodicityKeys] ?? periodicityKeys.mensual;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirming) {
      setConfirming(true);
      setMessage("");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const fiscalChanged = !companyData.fiscalConfigured
        || draft.regimeId !== companyData.regimeId
        || draft.fiscalStartDate !== companyData.fiscalStartDate
        || draft.fiscalEndDate !== companyData.fiscalEndDate
        || draft.fiscalPeriodicity !== companyData.fiscalPeriodicity;

      if (fiscalChanged) {
        const profileResponse = await fetch("/api/tax/profile", {
          body: JSON.stringify({
            companyId: companyData.id,
            endDate: draft.fiscalEndDate || null,
            periodicity: draft.fiscalPeriodicity,
            regimeId: draft.regimeId,
            startDate: draft.fiscalStartDate,
          }),
          headers: { "Content-Type": "application/json" }, method: "PATCH",
        });
        const profileResult = (await profileResponse.json()) as ApiResult;
        if (!profileResponse.ok) throw new Error(resultMessage(profileResult, t("preferences.saveError")));
      }

      const companyResponse = await fetch(`/api/companies/${encodeURIComponent(companyData.id)}`, {
        body: JSON.stringify({ nombreComercial: draft.nombre, rfc: draft.rfc }),
        headers: { "Content-Type": "application/json" }, method: "PATCH",
      });
      const companyResult = (await companyResponse.json()) as ApiResult;
      if (!companyResponse.ok) throw new Error(resultMessage(companyResult, t("preferences.saveError")));
      setConfirming(false);
      setOpen(false);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : t("preferences.saveError")); }
    finally { setBusy(false); }
  }

  function cancelEdition() {
    setDraft({
      fiscalEndDate: companyData.fiscalEndDate,
      fiscalPeriodicity: companyData.fiscalPeriodicity,
      fiscalStartDate: companyData.fiscalStartDate,
      nombre: companyData.nombre,
      regimeId: companyData.regimeId,
      rfc: companyData.rfc,
    });
    setConfirming(false);
    setOpen(false);
    setMessage("");
  }

  const modal = (
    <div
      className="profile-editor-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) cancelEdition();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="company-editor-title"
        aria-modal="true"
        className="profile-editor company-editor-modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="profile-editor-heading">
          <div>
            <span>{t("company.editorEyebrow")}</span>
            <h2 id="company-editor-title">{t("company.info")}</h2>
            <p>{t("company.editorHelp")}</p>
          </div>
          <button aria-label={t("button.close")} disabled={busy} onClick={cancelEdition} type="button">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="profile-editor-grid">
            <div className="company-editor-section wide">
              <strong>{t("company.generalData")}</strong>
              <span>{t("company.generalDataHelp")}</span>
            </div>
            <label className="wide">
              {t("company.commercialName")}
              <input
                disabled={busy}
                maxLength={160}
                onChange={(event) => setDraft((value) => ({ ...value, nombre: event.target.value }))}
                required
                value={draft.nombre}
              />
            </label>
            <label className="wide">
              {t("company.legalName")}
              <input disabled value={companyData.legalName} />
            </label>
            <label>
              RFC
              <input
                autoCapitalize="characters"
                disabled={busy}
                maxLength={13}
                minLength={12}
                onChange={(event) => setDraft((value) => ({ ...value, rfc: event.target.value.toUpperCase() }))}
                placeholder="XAXX010101000"
                required
                value={draft.rfc}
              />
            </label>
            <div className="company-editor-section wide">
              <strong>{t("company.fiscalConfiguration")}</strong>
              <span>{t("company.fiscalConfigurationHelp")}</span>
            </div>
            <label>
              {t("profile.fiscalRegime")}
              <select
                disabled={busy}
                onChange={(event) => setDraft((value) => ({ ...value, regimeId: event.target.value }))}
                required
                value={draft.regimeId}
              >
                <option disabled value="">{t("company.selectRegime")}</option>
                {regimes.map((regime) => (
                  <option disabled={!regime.selectable && regime.id !== companyData.regimeId} key={regime.id} value={regime.id}>
                    {regime.clave} · {regime.nombre}{!regime.selectable ? " · Solo perfiles existentes" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("company.startDate")}
              <input
                disabled={busy}
                onChange={(event) => setDraft((value) => ({ ...value, fiscalStartDate: event.target.value }))}
                required
                type="date"
                value={draft.fiscalStartDate}
              />
            </label>
            <label>
              {t("company.endDate")}
              <input
                disabled={busy}
                min={draft.fiscalStartDate || undefined}
                onChange={(event) => setDraft((value) => ({ ...value, fiscalEndDate: event.target.value }))}
                type="date"
                value={draft.fiscalEndDate}
              />
              <small>{t("company.endDateHelp")}</small>
            </label>
            <label className="wide">
              {t("company.periodicity")}
              <select
                disabled={busy}
                onChange={(event) => setDraft((value) => ({ ...value, fiscalPeriodicity: event.target.value }))}
                required
                value={draft.fiscalPeriodicity}
              >
                {(["mensual", "bimestral", "trimestral", "semestral", "anual"] as const).map((periodicity) => (
                  <option key={periodicity} value={periodicity}>{t(`company.periodicity.${periodicity}`)}</option>
                ))}
              </select>
            </label>
            <div className={`company-editor-guidance wide${companyData.fiscalConfigured ? " configured" : " pending"}`}>
              <Icon name={companyData.fiscalConfigured ? "verified" : "info"} />
              <div>
                <strong>{companyData.fiscalConfigured ? t("company.profileConfigured") : t("company.profilePending")}</strong>
                <p>{selectedRegime?.description || (selectedRegime ? t("company.configuredGuidance") : t("company.regimeGuidance"))}</p>
                {selectedRegime && (selectedRegime.validFrom || selectedRegime.validUntil) && (
                  <small>{t("company.regimeValidity", {
                    from: selectedRegime.validFrom || t("company.noDateLimit"),
                    until: selectedRegime.validUntil || t("company.noDateLimit"),
                  })}</small>
                )}
              </div>
            </div>
            <label className="wide">
              {t("company.fiscalAddress")}
              <input disabled value={companyData.address} />
            </label>
            <label>
              {t("profile.phone")}
              <input disabled value={companyData.phone} />
            </label>
            <label>
              {t("profile.email")}
              <input disabled type="email" value={companyData.email} />
            </label>
          </div>

          {confirming && (
            <section className="company-editor-confirmation" aria-live="polite">
              <div>
                <Icon name="verified" />
                <div>
                  <strong>{t("company.confirmTitle")}</strong>
                  <p>{t("company.confirmHelp")}</p>
                </div>
              </div>
              <dl>
                <div><dt>{t("company.commercialName")}</dt><dd>{draft.nombre}</dd></div>
                <div><dt>RFC</dt><dd>{draft.rfc}</dd></div>
                <div><dt>{t("profile.fiscalRegime")}</dt><dd>{selectedRegime ? `${selectedRegime.clave} · ${selectedRegime.nombre}` : "—"}</dd></div>
                <div><dt>{t("company.startDate")}</dt><dd>{draft.fiscalStartDate}</dd></div>
                <div><dt>{t("company.endDate")}</dt><dd>{draft.fiscalEndDate || t("company.noDateLimit")}</dd></div>
                <div><dt>{t("company.periodicity")}</dt><dd>{t(periodicityKey)}</dd></div>
              </dl>
            </section>
          )}

          {message && <p className="profile-editor-message company-editor-message" role="alert">{message}</p>}

          <div className="profile-editor-actions">
            <button
              disabled={busy}
              onClick={() => confirming ? setConfirming(false) : cancelEdition()}
              type="button"
            >
              {confirming ? t("company.backToEdit") : t("button.cancel")}
            </button>
            <button className="primary-button" disabled={busy || !regimes.length} type="submit">
              {busy
                ? t("common.saving")
                : confirming
                  ? t("company.confirmSave")
                  : t("company.reviewConfiguration")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );

  return (
    <>
      <button
        className="primary-button compact"
        onClick={() => {
          setDraft({
            fiscalEndDate: companyData.fiscalEndDate,
            fiscalPeriodicity: companyData.fiscalPeriodicity,
            fiscalStartDate: companyData.fiscalStartDate,
            nombre: companyData.nombre,
            regimeId: companyData.regimeId,
            rfc: companyData.rfc,
          });
          setConfirming(false);
          setMessage("");
          setOpen(true);
        }}
        type="button"
      >
        <Icon name="edit" />
        {t("button.editInfo")}
      </button>

      {open && createPortal(modal, document.body)}
    </>
  );
}
