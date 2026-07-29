"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { createTranslator } from "@/lib/i18n";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

export function SupportReplyForm({
  language = "es",
  messageId,
  recipient,
}: {
  language?: FiscalixLanguage;
  messageId: string;
  recipient: string;
}) {
  const router = useRouter();
  const t = createTranslator(language);
  const defaultReply = t("support.defaultReply");
  const [body, setBody] = useState(defaultReply);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const message = body.trim();
    if (message.length < 3) {
      setError(t("support.replyRequired"));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/support/messages/${encodeURIComponent(messageId)}/reply`, {
        body: JSON.stringify({ body: message }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string; success?: boolean };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || t("support.replyError"));
      }

      setBody(defaultReply);
      setSuccess(payload.message || t("support.replySuccess"));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("support.replyError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="support-reply-form" onSubmit={submit}>
      <header>
        <div>
          <p>{t("support.replyEyebrow")}</p>
          <h3>{t("support.replyTitle")}</h3>
          <small>{t("support.replyHelp", { recipient })}</small>
        </div>
        <Icon name="send" />
      </header>
      <textarea
        disabled={loading}
        maxLength={8000}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("support.replyPlaceholder")}
        required
        rows={7}
        value={body}
      />
      <footer>
        <span>{body.length}/8000</span>
        <button className="primary-button compact" disabled={loading || body.trim().length < 3} type="submit">
          {loading ? t("support.replySending") : t("support.replySend")}
        </button>
      </footer>
      {error ? <p className="support-reply-error" role="alert">{error}</p> : null}
      {success ? <p className="support-reply-success" role="status">{success}</p> : null}
    </form>
  );
}
