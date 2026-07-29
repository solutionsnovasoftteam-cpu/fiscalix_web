import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { SupportReplyForm } from "@/app/support/SupportReplyForm";
import { getCurrentUser } from "@/lib/auth";
import { createTranslator } from "@/lib/i18n";
import { sendPendingSupportAutoReplies } from "@/lib/supportAutoReply";
import {
  getGmailSetupStatus,
  getSupportMessage,
  isGmailConfigurationError,
  listSupportMessages,
  type SupportEmailDetail,
  type SupportInboxResult,
} from "@/lib/gmailSupport";
import { canViewAdminDashboard } from "@/lib/roles";
import {
  getSupportReviewStatus,
  isSupportReviewTableMissingError,
  setSupportMessageReviewed,
  withSupportReviewStatus,
  type SupportReviewStatus,
} from "@/lib/supportReviews";
import type { FiscalixLanguage } from "@/lib/userPreferences.shared";

type PageSearchParams = {
  messageId?: string;
  pageToken?: string;
  q?: string;
};

type ReviewedSupportEmailSummary = SupportInboxResult["messages"][number] & SupportReviewStatus;
type ReviewedSupportInboxResult = Omit<SupportInboxResult, "messages"> & {
  messages: ReviewedSupportEmailSummary[];
};
type ReviewedSupportEmailDetail = SupportEmailDetail & SupportReviewStatus;

function cleanParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string, language: FiscalixLanguage = "es") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return createTranslator(language)("support.dateUnavailable");
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "es-MX", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

async function loadInbox(params: PageSearchParams, language: FiscalixLanguage) {
  try {
    const inbox = await listSupportMessages({
      pageToken: params.pageToken,
      query: params.q,
    });

    await sendPendingSupportAutoReplies({
      body: createTranslator(language)("support.defaultReply"),
      messages: inbox.messages,
    }).catch((error) => {
      console.error("Error al procesar acuses automáticos:", error instanceof Error ? error.message : error);
    });

    const messages = await withSupportReviewStatus(inbox.messages);

    return { inbox: { ...inbox, messages }, setupError: null, systemError: "" };
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

async function loadSelectedMessage(messageId: string, reviewedBy: string) {
  if (!messageId) return null;

  try {
    const message = await getSupportMessage(messageId);
    const review = await setSupportMessageReviewed({
      messageId,
      reviewed: true,
      reviewedBy,
      threadId: message.threadId,
    }).catch(async (error) => {
      if (!isSupportReviewTableMissingError(error)) {
        console.error("Error al marcar aclaración como revisada:", error instanceof Error ? error.message : error);
      }

      return getSupportReviewStatus(messageId);
    });

    return { ...message, ...review };
  } catch (error) {
    console.error("Error al cargar mensaje seleccionado:", error instanceof Error ? error.message : error);
    return null;
  }
}

function SupportSetupCard({
  language = "es",
  missing,
  supportEmail,
}: {
  language?: FiscalixLanguage;
  missing: string[];
  supportEmail: string;
}) {
  const t = createTranslator(language);
  return (
    <section className="support-setup-card">
      <span><Icon name="lock" /></span>
      <div>
        <p>{t("support.pendingConnection")}</p>
        <h2>{t("support.gmailNotConfigured")}</h2>
        <small>
          {t("support.setupHelp", { email: supportEmail })}
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
  language = "es",
  params,
}: {
  inbox: ReviewedSupportInboxResult;
  language?: FiscalixLanguage;
  params: PageSearchParams;
}) {
  const t = createTranslator(language);
  if (!inbox.messages.length) {
    return (
      <div className="support-empty">
        <span><Icon name="mark_email_unread" /></span>
        <strong>{t("support.empty")}</strong>
        <small>{t("support.emptyHelp")}</small>
      </div>
    );
  }

  return (
    <div className="support-message-list">
      {inbox.messages.map((message) => (
        <Link
          className={`${params.messageId === message.id ? "support-message active" : "support-message"}${message.reviewed ? " reviewed" : " pending-review"}`}
          href={buildHref(params, { messageId: message.id })}
          key={message.id}
        >
          <span className={message.reviewed ? "support-unread-dot" : "support-unread-dot active"} />
          <div>
            <strong>{message.subject}</strong>
            <small>{message.from}</small>
            <p>{message.snippet || t("support.noPreview")}</p>
          </div>
          <div className="support-message-meta">
            <time>{formatDate(message.date, language)}</time>
            <span className={message.reviewed ? "support-review-pill reviewed" : "support-review-pill pending"}>
              {message.reviewed ? t("support.reviewed") : t("support.unreviewed")}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MessageDetail({
  language = "es",
  message,
}: {
  language?: FiscalixLanguage;
  message: ReviewedSupportEmailDetail | null;
}) {
  const t = createTranslator(language);
  if (!message) {
    return (
      <aside className="support-detail-panel">
        <div className="support-empty compact">
          <span><Icon name="mail" /></span>
          <strong>{t("support.select")}</strong>
          <small>{t("support.selectHelp")}</small>
        </div>
      </aside>
    );
  }

  return (
    <aside className="support-detail-panel">
      <header>
        <p>{t("support.detail")}</p>
        <h2>{message.subject}</h2>
        <small>{message.from}</small>
        <div className="support-detail-meta">
          <time>{formatDate(message.date, language)}</time>
          <span className={message.reviewed ? "support-review-pill reviewed" : "support-review-pill pending"}>
            {message.reviewed ? t("support.reviewed") : t("support.unreviewed")}
          </span>
        </div>
      </header>
      <article>
        {message.body.split(/\n{2,}/).map((paragraph, index) => (
          <p key={`${message.id}-${index}`}>{paragraph}</p>
        ))}
      </article>
      <SupportReplyForm language={language} messageId={message.id} recipient={message.replyTo || message.from} />
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
  const language = user.preferences?.language ?? "es";
  const t = createTranslator(language);

  const resolvedParams = await searchParams;
  const params = {
    messageId: cleanParam(resolvedParams.messageId),
    pageToken: cleanParam(resolvedParams.pageToken),
    q: cleanParam(resolvedParams.q),
  };
  const setupStatus = getGmailSetupStatus();
  const { inbox, setupError, systemError } = await loadInbox(params, language);
  const selectedMessage = inbox && params.messageId ? await loadSelectedMessage(params.messageId, user.id) : null;
  const visibleInbox = inbox && selectedMessage
    ? {
        ...inbox,
        messages: inbox.messages.map((message) => (
          message.id === selectedMessage.id
            ? { ...message, reviewed: selectedMessage.reviewed, reviewedAt: selectedMessage.reviewedAt, reviewedBy: selectedMessage.reviewedBy }
            : message
        )),
      }
    : inbox;

  return (
    <AppShell activeHref="/support" user={user}>
      <main className="support-page">
        <header className="support-hero">
          <div>
            <p>{t("support.eyebrow")}</p>
            <h1>{t("support.title")}</h1>
            <span>
              {t("support.description", { email: setupStatus.supportEmail })}
            </span>
          </div>
          <form action="/support" className="support-search">
            <Icon name="search" />
            <input
              aria-label={t("support.searchLabel")}
              defaultValue={params.q}
              name="q"
              placeholder={t("support.searchPlaceholder")}
              type="search"
            />
            <button type="submit">{t("button.search")}</button>
          </form>
        </header>

        <section className="support-summary" aria-label={t("support.eyebrow")}>
          <article>
            <span><Icon name="alternate_email" /></span>
            <div>
              <small>{t("support.connectedEmail")}</small>
              <strong>{setupStatus.supportEmail}</strong>
            </div>
          </article>
          <article>
            <span><Icon name="inbox" /></span>
            <div>
              <small>{t("support.estimatedResults")}</small>
              <strong>{visibleInbox?.resultSizeEstimate ?? 0}</strong>
            </div>
          </article>
          <article>
            <span><Icon name={setupStatus.configured ? "check_circle" : "warning"} /></span>
            <div>
              <small>{t("support.connectionStatus")}</small>
              <strong>{setupStatus.configured ? t("support.configured") : t("support.setupPending")}</strong>
            </div>
          </article>
        </section>

        {setupError ? <SupportSetupCard language={language} missing={setupError.missing} supportEmail={setupError.supportEmail} /> : null}
        {systemError ? <p className="support-error">{t("support.loadError")}</p> : null}

        <section className="support-grid">
          <article className="support-inbox-panel">
            <header>
              <div>
                <p>{t("support.inbox")}</p>
                <h2>{t("support.received")}</h2>
              </div>
              {params.q ? <Link href="/support">{t("support.clearSearch")}</Link> : null}
            </header>

            {visibleInbox ? <MessageList inbox={visibleInbox} language={language} params={params} /> : null}

            {visibleInbox?.nextPageToken ? (
              <footer>
                <Link href={buildHref(params, { messageId: "", pageToken: visibleInbox.nextPageToken })}>
                  {t("support.nextPage")}
                  <Icon name="arrow_forward" />
                </Link>
              </footer>
            ) : null}
          </article>

          <MessageDetail language={language} message={selectedMessage} />
        </section>
      </main>
    </AppShell>
  );
}
