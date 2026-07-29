"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";
import { useModal } from "@/lib/useModal";

type Regime = { clave: string; id: string; nombre: string };
type CompanyEditorData = {
  address: string;
  email: string;
  id: string;
  legalName: string;
  nombre: string;
  phone: string;
  regimeId: string;
  rfc: string;
};
type CompanyDraft = Pick<CompanyEditorData, "nombre" | "regimeId" | "rfc">;

export function CompanyFiscalEditor({ company, language = "es", regimes }: {
  company: CompanyEditorData | null;
  language?: FiscalixLanguage;
  regimes: Regime[];
}) {
  const router = useRouter();
  const t = createTranslator(language);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<CompanyDraft>({
    nombre: company?.nombre ?? "",
    regimeId: company?.regimeId ?? "",
    rfc: company?.rfc ?? "",
  });
  const close = useCallback(() => setOpen(false), [setOpen]);
  useModal({ busy, dialogRef, onClose: close, open });

  if (!company) return null;
  const companyData = company;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyData.id)}`, {
        body: JSON.stringify({ nombreComercial: draft.nombre, regimenId: draft.regimeId, rfc: draft.rfc }),
        headers: { "Content-Type": "application/json" }, method: "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? t("preferences.saveError"));
      setOpen(false);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : t("preferences.saveError")); }
    finally { setBusy(false); }
  }

  function cancelEdition() {
    setDraft({ nombre: companyData.nombre, regimeId: companyData.regimeId, rfc: companyData.rfc });
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
                  <option key={regime.id} value={regime.id}>{regime.clave} · {regime.nombre}</option>
                ))}
              </select>
            </label>
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

          {message && <p className="profile-editor-message company-editor-message" role="alert">{message}</p>}

          <div className="profile-editor-actions">
            <button disabled={busy} onClick={cancelEdition} type="button">{t("button.cancel")}</button>
            <button className="primary-button" disabled={busy || !regimes.length} type="submit">
              {busy ? t("common.saving") : t("button.saveChanges")}
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
          setDraft({ nombre: companyData.nombre, regimeId: companyData.regimeId, rfc: companyData.rfc });
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
