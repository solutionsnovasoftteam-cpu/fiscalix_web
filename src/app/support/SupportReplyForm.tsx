"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

export function SupportReplyForm({
  messageId,
  recipient,
}: {
  messageId: string;
  recipient: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const message = body.trim();
    if (message.length < 3) {
      setError("Escribe una respuesta antes de enviar.");
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
        throw new Error(payload.message || "No fue posible enviar la respuesta.");
      }

      setBody("");
      setSuccess(payload.message || "Respuesta enviada correctamente.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible enviar la respuesta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="support-reply-form" onSubmit={submit}>
      <header>
        <div>
          <p>RESPONDER ACLARACIÓN</p>
          <h3>Enviar respuesta</h3>
          <small>Se enviará desde el correo de soporte al remitente: {recipient}</small>
        </div>
        <Icon name="send" />
      </header>
      <textarea
        disabled={loading}
        maxLength={8000}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escribe aquí la respuesta para el cliente..."
        required
        rows={7}
        value={body}
      />
      <footer>
        <span>{body.length}/8000</span>
        <button className="primary-button compact" disabled={loading || body.trim().length < 3} type="submit">
          {loading ? "Enviando..." : "Enviar respuesta"}
        </button>
      </footer>
      {error ? <p className="support-reply-error" role="alert">{error}</p> : null}
      {success ? <p className="support-reply-success" role="status">{success}</p> : null}
    </form>
  );
}
