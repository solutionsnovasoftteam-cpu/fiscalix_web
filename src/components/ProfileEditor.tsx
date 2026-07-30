//Copyright (c) 2024 Fiscalix, Inc. All rights reserved.
"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";
import { useModal } from "@/lib/useModal";

type ProfileEditorProps = {
  apellido: string;
  correo: string;
  language?: FiscalixLanguage;
  nombre: string;
  telefono: string;
};

export function ProfileEditor({ apellido, correo, language = "es", nombre, telefono }: ProfileEditorProps) {
  const router = useRouter();
  const t = createTranslator(language);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailValue, setEmailValue] = useState(correo);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useModal({ busy, dialogRef, onClose: close, open });

  const emailChanged = emailValue.trim().toLowerCase() !== correo.toLowerCase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/users", {
        body: JSON.stringify({
          apellido: form.get("apellido"),
          correo: form.get("correo"),
          currentPassword: form.get("currentPassword"),
          nombre: form.get("nombre"),
          telefono: form.get("telefono"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? t("preferences.saveError"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("preferences.saveError"));
    } finally {
      setBusy(false);
    }
  }

  const modal = open ? (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <section aria-labelledby="profile-editor-title" aria-modal="true" className="profile-editor" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="profile-editor-heading">
          <div><span>{t("profile.editorEyebrow")}</span><h2 id="profile-editor-title">{t("profile.editorTitle")}</h2><p>{t("profile.editorHelp")}</p></div>
          <button aria-label={t("button.close")} disabled={busy} onClick={() => setOpen(false)} type="button"><Icon name="close" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="profile-editor-grid">
            <label>{t("profile.firstName")}<input defaultValue={nombre} maxLength={80} name="nombre" required /></label>
            <label>{t("profile.lastName")}<input defaultValue={apellido} maxLength={80} name="apellido" required /></label>
            <label className="wide">{t("profile.phone")}<input defaultValue={telefono} inputMode="tel" maxLength={25} name="telefono" placeholder={t("profile.phoneExample")} /></label>
            <label className="wide">
              {t("profile.email")}
              <input
                autoComplete="email"
                maxLength={160}
                name="correo"
                onChange={(event) => setEmailValue(event.target.value)}
                required
                type="email"
                value={emailValue}
              />
              <small>{t("profile.emailChangeHelp")}</small>
            </label>
            <label className="wide">
              {t("profile.currentPassword")}
              <input
                autoComplete="current-password"
                disabled={!emailChanged || busy}
                name="currentPassword"
                placeholder={emailChanged ? t("profile.passwordChangePlaceholder") : t("profile.passwordOnlyIfEmail")}
                required={emailChanged}
                type="password"
              />
              <small>{t("profile.passwordValidationHelp")}</small>
            </label>
          </div>
          {message && <p className="profile-editor-message" role="alert">{message}</p>}
          <div className="profile-editor-actions"><button disabled={busy} onClick={() => setOpen(false)} type="button">{t("button.cancel")}</button><button className="primary-button" disabled={busy} type="submit">{busy ? t("common.saving") : t("button.saveChanges")}</button></div>
        </form>
      </section>
    </div>
  ) : null;
  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button onClick={() => { setEmailValue(correo); setMessage(""); setOpen(true); }} type="button">{t("button.editInfo")}</button>
      {portalTarget && modal ? createPortal(modal, portalTarget) : null}
    </>
  );
}
