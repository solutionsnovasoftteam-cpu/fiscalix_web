"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useModal } from "@/lib/useModal";

type Regime = { clave: string; id: string; nombre: string };

export function CompanyFiscalEditor({ company, regimes }: {
  company: { id: string; nombre: string; regimeId: string; rfc: string } | null;
  regimes: Regime[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModal({ busy, dialogRef, onClose: close, open });

  if (!company) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(company!.id)}`, {
        body: JSON.stringify({ nombreComercial: form.get("nombreComercial"), regimenId: form.get("regimenId"), rfc: form.get("rfc") }),
        headers: { "Content-Type": "application/json" }, method: "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "No fue posible guardar los cambios.");
      setOpen(false); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible guardar los cambios."); }
    finally { setBusy(false); }
  }

  return <>
    <button className="primary-button compact" onClick={() => { setMessage(""); setOpen(true); }} type="button"><Icon name="edit" /> Editar información</button>
    {open && <div className="profile-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section aria-labelledby="company-editor-title" aria-modal="true" className="profile-editor" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="profile-editor-heading"><div><span>DATOS FISCALES</span><h2 id="company-editor-title">Editar empresa</h2><p>Registra los datos tal como aparecen en la constancia fiscal.</p></div><button aria-label="Cerrar" disabled={busy} onClick={() => setOpen(false)} type="button"><Icon name="close" /></button></div>
        <form onSubmit={submit}>
          <div className="profile-editor-grid">
            <label className="wide">Nombre comercial<input defaultValue={company.nombre} maxLength={160} name="nombreComercial" required /></label>
            <label>RFC<input autoCapitalize="characters" defaultValue={company.rfc} maxLength={13} minLength={12} name="rfc" placeholder="XAXX010101000" required /></label>
            <label>Régimen fiscal<select defaultValue={company.regimeId} name="regimenId" required><option disabled value="">Selecciona un régimen</option>{regimes.map((regime) => <option key={regime.id} value={regime.id}>{regime.clave} · {regime.nombre}</option>)}</select></label>
          </div>
          {message && <p className="profile-editor-message" role="alert">{message}</p>}
          <div className="profile-editor-actions"><button disabled={busy} onClick={() => setOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={busy || !regimes.length} type="submit">{busy ? "Guardando..." : "Guardar cambios"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
