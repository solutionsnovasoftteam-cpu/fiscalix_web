"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  browserSessionPersistence,
  PhoneAuthProvider,
  RecaptchaVerifier,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updatePhoneNumber,
  type Auth,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { getFiscalixFirebaseAuth } from "@/lib/firebaseClient";
import { createTranslator } from "@/lib/i18n";
import { useModal } from "@/lib/useModal";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

type PhoneVerificationButtonProps = {
  email: string;
  initialPhone?: string | null;
  language?: FiscalixLanguage;
  phoneVerified: boolean;
};

function normalizeMexicanPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+52${digits}`;
  if (digits.startsWith("52") && digits.length === 12) return `+${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : "";
}

function getFirebaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function friendlyPhoneError(error: unknown, t: ReturnType<typeof createTranslator>) {
  const code = getFirebaseErrorCode(error);
  if (code === "auth/invalid-phone-number") return t("profile.phoneVerificationInvalidPhone");
  if (code === "auth/too-many-requests") return t("profile.phoneVerificationTooManyRequests");
  if (code === "auth/invalid-verification-code") return t("profile.phoneVerificationInvalidCode");
  if (code === "auth/credential-already-in-use" || code === "auth/phone-number-already-exists") return t("profile.phoneVerificationAlreadyUsed");
  if (code === "auth/operation-not-allowed") return t("profile.phoneVerificationProviderDisabled");
  if (code === "auth/captcha-check-failed" || code === "auth/missing-app-credential") return t("profile.phoneVerificationCaptchaError");
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") return t("profile.phoneVerificationInvalidPassword");
  if (code === "auth/requires-recent-login") return t("profile.phoneVerificationRecentLogin");
  return error instanceof Error ? error.message : t("profile.phoneVerificationError");
}

export function PhoneVerificationButton({
  email,
  initialPhone = "",
  language = "es",
  phoneVerified,
}: PhoneVerificationButtonProps) {
  const router = useRouter();
  const t = createTranslator(language);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("success");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [step, setStep] = useState<"send" | "confirm">("send");
  const [verificationId, setVerificationId] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const close = useCallback(() => {
    if (busy) return;
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
    setOpen(false);
  }, [busy, setOpen]);
  useModal({ busy, dialogRef, onClose: close, open });

  function resetModal() {
    setBusy(false);
    setCode("");
    setMessage("");
    setMessageType("success");
    setPassword("");
    setPhone(initialPhone ?? "");
    setStep("send");
    setVerificationId("");
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  }

  async function getVerifier(auth: Auth) {
    if (recaptchaVerifierRef.current) return recaptchaVerifierRef.current;
    if (!recaptchaContainerRef.current) throw new Error(t("profile.phoneVerificationCaptchaError"));

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
    });
    await verifier.render();
    recaptchaVerifierRef.current = verifier;
    return verifier;
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageType("success");

    const normalizedPhone = normalizeMexicanPhone(phone);
    if (!normalizedPhone) {
      setBusy(false);
      setMessageType("error");
      setMessage(t("profile.phoneVerificationInvalidPhone"));
      return;
    }

    try {
      const auth = await getFiscalixFirebaseAuth();
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      const verifier = await getVerifier(auth);
      const provider = new PhoneAuthProvider(auth);
      const nextVerificationId = await provider.verifyPhoneNumber(normalizedPhone, verifier);
      setPhone(normalizedPhone);
      setVerificationId(nextVerificationId);
      setStep("confirm");
      setMessage(t("profile.smsSent"));
      setMessageType("success");
    } catch (error) {
      recaptchaVerifierRef.current?.clear();
      recaptchaVerifierRef.current = null;
      setMessageType("error");
      setMessage(friendlyPhoneError(error, t));
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const normalizedPhone = normalizeMexicanPhone(phone);
      const auth = await getFiscalixFirebaseAuth();
      if (!auth.currentUser) throw new Error(t("profile.phoneVerificationRecentLogin"));
      if (!verificationId || !normalizedPhone) throw new Error(t("profile.phoneVerificationError"));

      const credential = PhoneAuthProvider.credential(verificationId, code.trim());
      await updatePhoneNumber(auth.currentUser, credential);

      const response = await fetch("/api/auth/phone-verification", {
        body: JSON.stringify({ phone: normalizedPhone }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; success?: boolean };
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || t("profile.phoneVerificationSyncError"));
      }

      await signOut(auth).catch(() => undefined);
      setMessageType("success");
      setMessage(payload.message || t("profile.phoneVerifiedSuccess"));
      router.refresh();
      window.setTimeout(() => {
        resetModal();
        setOpen(false);
      }, 900);
    } catch (error) {
      setMessageType("error");
      setMessage(friendlyPhoneError(error, t));
    } finally {
      setBusy(false);
    }
  }

  const modal = open ? (
    <div className="profile-editor-backdrop phone-verification-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
      <section aria-labelledby="phone-verification-title" aria-modal="true" className="profile-editor phone-verification-modal" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="profile-editor-heading">
          <div>
            <span>{t("profile.phoneVerificationEyebrow")}</span>
            <h2 id="phone-verification-title">{t("profile.phoneVerificationTitle")}</h2>
            <p>{t("profile.phoneVerificationHelp")}</p>
          </div>
          <button aria-label={t("button.close")} disabled={busy} onClick={close} type="button"><Icon name="close" /></button>
        </div>

        {step === "send" ? (
          <form onSubmit={sendCode}>
            <div className="profile-editor-grid">
              <label className="wide">
                {t("profile.phoneVerificationPhone")}
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={25}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t("profile.phoneExample")}
                  required
                  value={phone}
                />
                <small>{t("profile.phoneVerificationPhoneHelp")}</small>
              </label>
              <label className="wide">
                {t("profile.phoneVerificationPassword")}
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("profile.phoneVerificationPasswordPlaceholder")}
                  required
                  type="password"
                  value={password}
                />
                <small>{t("profile.phoneVerificationPasswordHelp")}</small>
              </label>
            </div>
            {message && <p className={`profile-editor-message ${messageType === "success" ? "is-success" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</p>}
            <div className="phone-recaptcha-container" ref={recaptchaContainerRef} />
            <div className="profile-editor-actions">
              <button disabled={busy} onClick={close} type="button">{t("button.cancel")}</button>
              <button className="primary-button" disabled={busy} type="submit">{busy ? t("profile.sending") : t("profile.sendSms")}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmCode}>
            <div className="profile-editor-grid">
              <label className="wide">
                {t("profile.phoneVerificationCode")}
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder={t("profile.phoneVerificationCodePlaceholder")}
                  required
                  value={code}
                />
                <small>{t("profile.phoneVerificationConfirmHelp", { phone })}</small>
              </label>
            </div>
            {message && <p className={`profile-editor-message ${messageType === "success" ? "is-success" : ""}`} role={messageType === "error" ? "alert" : "status"}>{message}</p>}
            <div className="profile-editor-actions">
              <button disabled={busy} onClick={() => { setStep("send"); setVerificationId(""); setCode(""); }} type="button">{t("profile.changePhone")}</button>
              <button className="primary-button" disabled={busy} type="submit">{busy ? t("common.saving") : t("profile.confirmPhone")}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  ) : null;
  const portalTarget = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button
        className={`profile-action phone-verification-action${phoneVerified ? " is-verified" : ""}`}
        onClick={() => { resetModal(); setOpen(true); }}
        type="button"
      >
        <Icon name={phoneVerified ? "verified_user" : "call"} />
        {phoneVerified ? t("profile.updateVerifiedPhone") : t("profile.verifyPhone")}
        <b>›</b>
      </button>
      {portalTarget && modal ? createPortal(modal, portalTarget) : null}
    </>
  );
}
