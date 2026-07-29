"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

export function EmailVerificationCard({ emailVerified, language = "es" }: { emailVerified: boolean; language?: FiscalixLanguage }) {
  const t = createTranslator(language);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function resendVerification() {
    setMessage("");
    setIsError(false);
    setIsPending(true);

    try {
      const response = await fetch("/api/auth/email-verification", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message || t("profile.resendError"));
      }

      setMessage(payload.message || t("profile.resendSuccess"));
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : t("profile.resendError"));
    } finally {
      setIsPending(false);
    }
  }

  if (emailVerified) {
    return (
      <aside className="verified-card">
        <span className="verified-shield"><Icon name="check" /></span>
        <div>
          <h2>{t("profile.verifiedCardTitle")} <span>●</span></h2>
          <p>{t("profile.verifiedCardHelp")}</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="verified-card pending">
      <span className="verified-shield"><Icon name="mail" /></span>
      <div>
        <h2>{t("profile.emailPendingTitle")} <span>●</span></h2>
        <p>{t("profile.emailPendingHelp")}</p>
        <div className="email-verification-actions">
          <button disabled={isPending} onClick={resendVerification} type="button">
            {isPending ? t("profile.sending") : t("profile.resendVerification")}
          </button>
          {message && (
            <small className={isError ? "is-error" : "is-success"} role="status">
              {message}
            </small>
          )}
        </div>
      </div>
    </aside>
  );
}
