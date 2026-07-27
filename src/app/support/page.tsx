import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { SupportReplyForm } from "@/app/support/SupportReplyForm";
import { getCurrentUser } from "@/lib/auth";
import {
  getGmailSetupStatus,
  getSupportMessage,
  isGmailConfigurationError,
  listSupportMessages,
  type SupportEmailDetail,
  type SupportInboxResult,
} from "@/lib/gmailSupport";
import { canViewAdminDashboard } from "@/lib/roles";

type PageSearchParams = {
  messageId?: string;
  pageToken?: string;
  q?: string;
};

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

function cleanParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : dateFormatter.format(date);
}

function buildHref(current: PageSearchParams, next: Partial<PageSearchParams>) {
  const params = new URLSearchParams();
  const merged = { ...current, ...next };

  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `/support?${query}` : "/support";
}

async function loadInbox(params: PageSearchParams) {
  try {
    const inbox = await listSupportMessages({
      pageToken: params.pageToken,
      query: params.q,
    });

    return { inbox, setupError: null, systemError: "" };
  } catch (error) {
    if (isGmailConfigurationError(error)) {
      return { inbox: null, setupError: error, systemError: "" };
    }

    console.error("Error al cargar aclaraciones:", error instanceof Error ? error.message : error);
    return {
      inbox: null,
      setupError: null,
      systemError: "No fue posible cargar la bandeja de Gmail en este momento.",
    };
  }
}

async function loadSelectedMessage(messageId: string) {
  if (!messageId) return null;

  try {
    return await getSupportMessage(messageId);
  } catch (error) {
    console.error("Error al cargar mensaje seleccionado:", error instanceof Error ? error.message : error);
    return null;
  }
}

function SupportSetupCard({
  missing,
  supportEmail,
}: {
  missing: string[];
  supportEmail: string;
}) {
  return (
    <section className="support-setup-card">
      <span><Icon name="lock" /></span>
      <div>
        <p>CONEXIÓN PENDIENTE</p>
        <h2>Gmail aún no está configurado</h2>
        <small>
          La bandeja está preparada para consultar {supportEmail}, pero faltan secretos de OAuth en el servidor.
        </small>
      </div>
      <ul>
        {missing.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function MessageList({
  inbox,
  params,
}: {
  inbox: SupportInboxResult;
  params: PageSearchParams;
}) {
  if (!inbox.messages.length) {
    return (
      <div className="support-empty">
        <span><Icon name="mark_email_unread" /></span>
        <strong>No hay correos para mostrar</strong>
        <small>Prueba otra búsqueda o revisa directamente la bandeja de Gmail.</small>
      </div>
    );
  }

  return (
    <div className="support-message-list">
      {inbox.messages.map((message) => (
        <Link
          className={params.messageId === message.id ? "support-message active" : "support-message"}
          href={buildHref(params, { messageId: message.id })}
          key={message.id}
        >
          <span className={message.unread ? "support-unread-dot active" : "support-unread-dot"} />
          <div>
            <strong>{message.subject}</strong>
            <small>{message.from}</small>
            <p>{message.snippet || "Sin vista previa disponible."}</p>
          </div>
          <time>{formatDate(message.date)}</time>
        </Link>
      ))}
    </div>
  );
}

function MessageDetail({ message }: { message: SupportEmailDetail | null }) {
  if (!message) {
    return (
      <aside className="support-detail-panel">
        <div className="support-empty compact">
          <span><Icon name="mail" /></span>
          <strong>Selecciona una aclaración</strong>
          <small>El detalle del correo aparecerá en este panel.</small>
        </div>
      </aside>
    );
  }

  return (
    <aside className="support-detail-panel">
      <header>
        <p>DETALLE DEL CORREO</p>
        <h2>{message.subject}</h2>
        <small>{message.from}</small>
        <time>{formatDate(message.date)}</time>
      </header>
      <article>
        {message.body.split(/\n{2,}/).map((paragraph, index) => (
          <p key={`${message.id}-${index}`}>{paragraph}</p>
        ))}
      </article>
      <SupportReplyForm messageId={message.id} recipient={message.replyTo || message.from} />
    </aside>
  );
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewAdminDashboard(user)) redirect("/dashboard");

  const resolvedParams = await searchParams;
  const params = {
    messageId: cleanParam(resolvedParams.messageId),
    pageToken: cleanParam(resolvedParams.pageToken),
    q: cleanParam(resolvedParams.q),
  };
  const setupStatus = getGmailSetupStatus();
  const { inbox, setupError, systemError } = await loadInbox(params);
  const selectedMessage = inbox && params.messageId ? await loadSelectedMessage(params.messageId) : null;

  return (
    <AppShell activeHref="/support" user={user}>
      <main className="support-page">
        <header className="support-hero">
          <div>
            <p>CENTRO DE ACLARACIONES</p>
            <h1>Bandeja de soporte</h1>
            <span>
              Consulta los correos recibidos en {setupStatus.supportEmail} desde Fiscalix.
            </span>
          </div>
          <form action="/support" className="support-search">
            <Icon name="search" />
            <input
              aria-label="Buscar correos de aclaraciones"
              defaultValue={params.q}
              name="q"
              placeholder="Buscar por remitente, asunto o texto..."
              type="search"
            />
            <button type="submit">Buscar</button>
          </form>
        </header>

        <section className="support-summary" aria-label="Resumen de aclaraciones">
          <article>
            <span><Icon name="alternate_email" /></span>
            <div>
              <small>Correo conectado</small>
              <strong>{setupStatus.supportEmail}</strong>
            </div>
          </article>
          <article>
            <span><Icon name="inbox" /></span>
            <div>
              <small>Resultados estimados</small>
              <strong>{inbox?.resultSizeEstimate ?? 0}</strong>
            </div>
          </article>
          <article>
            <span><Icon name={setupStatus.configured ? "check_circle" : "warning"} /></span>
            <div>
              <small>Estado de conexión</small>
              <strong>{setupStatus.configured ? "Configurada" : "Pendiente"}</strong>
            </div>
          </article>
        </section>

        {setupError ? <SupportSetupCard missing={setupError.missing} supportEmail={setupError.supportEmail} /> : null}
        {systemError ? <p className="support-error">{systemError}</p> : null}

        <section className="support-grid">
          <article className="support-inbox-panel">
            <header>
              <div>
                <p>BANDEJA DE ENTRADA</p>
                <h2>Aclaraciones recibidas</h2>
              </div>
              {params.q ? <Link href="/support">Limpiar búsqueda</Link> : null}
            </header>

            {inbox ? <MessageList inbox={inbox} params={params} /> : null}

            {inbox?.nextPageToken ? (
              <footer>
                <Link href={buildHref(params, { messageId: "", pageToken: inbox.nextPageToken })}>
                  Siguiente página
                  <Icon name="arrow_forward" />
                </Link>
              </footer>
            ) : null}
          </article>

          <MessageDetail message={selectedMessage} />
        </section>
      </main>
    </AppShell>
  );
}
