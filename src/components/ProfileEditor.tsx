"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useModal } from "@/lib/useModal";

type ProfileEditorProps = {
  apellido: string;
  correo: string;
  nombre: string;
  telefono: string;
};

export function ProfileEditor({ apellido, correo, nombre, telefono }: ProfileEditorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useModal({ busy, dialogRef, onClose: close, open });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/users", {
        body: JSON.stringify({
          apellido: form.get("apellido"),
          nombre: form.get("nombre"),
          telefono: form.get("telefono"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "No fue posible guardar los cambios.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar los cambios.");
    } finally {
      setBusy(false);
    }
  }

  const modal = open ? (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section aria-labelledby="profile-editor-title" aria-modal="true" className="profile-editor" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="profile-editor-heading">
          <div><span>PERFIL PERSONAL</span><h2 id="profile-editor-title">Editar información</h2><p>Actualiza los datos visibles en tu cuenta.</p></div>
          <button aria-label="Cerrar" disabled={busy} onClick={() => setOpen(false)} type="button"><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="profile-editor-grid">
            <label>Nombre<input defaultValue={nombre} maxLength={80} name="nombre" required /></label>
            <label>Apellido<input defaultValue={apellido} maxLength={80} name="apellido" required /></label>
            <label className="wide">Teléfono<input defaultValue={telefono} inputMode="tel" maxLength={25} name="telefono" placeholder="Ej. 55 1234 5678" /></label>
            <label className="wide">Correo electrónico<input defaultValue={correo} disabled type="email" /><small>El correo de acceso no se cambia desde el perfil.</small></label>
          </div>
          {message && <p className="profile-editor-message" role="alert">{message}</p>}
          <div className="profile-editor-actions"><button disabled={busy} onClick={() => setOpen(false)} type="button">Cancelar</button><button className="primary-button" disabled={busy} type="submit">{busy ? "Guardando..." : "Guardar cambios"}</button></div>
        </form>
      </section>
    </div>
  ) : null;
  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button onClick={() => { setMessage(""); setOpen(true); }} type="button">Editar información</button>
      {portalTarget && modal ? createPortal(modal, portalTarget) : null}
    </>
  );
}
