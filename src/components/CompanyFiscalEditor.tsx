"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
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

export function CompanyFiscalEditor({ company, regimes }: {
  company: CompanyEditorData | null;
  regimes: Regime[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<CompanyDraft>({
    nombre: company?.nombre ?? "",
    regimeId: company?.regimeId ?? "",
    rfc: company?.rfc ?? "",
  });
  const close = useCallback(() => setOpen(false), []);
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
      if (!response.ok) throw new Error(result.message ?? "No fue posible guardar los cambios.");
      setOpen(false);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar los cambios."); }
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
            <span>DATOS FISCALES</span>
            <h2 id="company-editor-title">Información de la empresa</h2>
            <p>Actualiza los datos fiscales principales de la empresa vinculada.</p>
          </div>
          <button aria-label="Cerrar" disabled={busy} onClick={cancelEdition} type="button">
            <Icon name="close" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="profile-editor-grid">
            <label className="wide">
              Nombre comercial
              <input
                disabled={busy}
                maxLength={160}
                onChange={(event) => setDraft((value) => ({ ...value, nombre: event.target.value }))}
                required
                value={draft.nombre}
              />
            </label>
            <label className="wide">
              Razón social
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
              Régimen fiscal
              <select
                disabled={busy}
                onChange={(event) => setDraft((value) => ({ ...value, regimeId: event.target.value }))}
                required
                value={draft.regimeId}
              >
                <option disabled value="">Selecciona un régimen</option>
                {regimes.map((regime) => (
                  <option key={regime.id} value={regime.id}>{regime.clave} · {regime.nombre}</option>
                ))}
              </select>
            </label>
            <label className="wide">
              Dirección fiscal
              <input disabled value={companyData.address} />
            </label>
            <label>
              Teléfono
              <input disabled value={companyData.phone} />
            </label>
            <label>
              Correo electrónico
              <input disabled type="email" value={companyData.email} />
            </label>
          </div>

          {message && <p className="profile-editor-message company-editor-message" role="alert">{message}</p>}

          <div className="profile-editor-actions">
            <button disabled={busy} onClick={cancelEdition} type="button">Cancelar</button>
            <button className="primary-button" disabled={busy || !regimes.length} type="submit">
              {busy ? "Guardando..." : "Guardar cambios"}
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
        Editar información
      </button>

      {open && createPortal(modal, document.body)}
    </>
  );
}
