import "server-only";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_SUPPORT_EMAIL = "solutionsnovasoftteam@gmail.com";
const DEFAULT_SUPPORT_QUERY = "in:inbox -category:promotions -category:social";

type GmailTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  token_type?: string;
};

type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailHeader = {
  name?: string;
  value?: string;
};

type GmailPayloadPart = {
  body?: { data?: string };
  headers?: GmailHeader[];
  mimeType?: string;
  parts?: GmailPayloadPart[];
};

type GmailMessageResponse = {
  id?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayloadPart;
  snippet?: string;
  threadId?: string;
};

type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  supportEmail: string;
  supportQuery: string;
};

export type SupportEmailSummary = {
  date: string;
  from: string;
  id: string;
  labels: string[];
  snippet: string;
  subject: string;
  threadId: string;
  unread: boolean;
};

export type SupportEmailDetail = SupportEmailSummary & {
  body: string;
  messageIdHeader: string;
  references: string;
  replyTo: string;
};

export type SupportReplyResult = {
  id: string;
  threadId: string;
};

export type SupportOutboundEmail = {
  body: string;
  subject: string;
  to: string;
};

export type SupportInboxResult = {
  messages: SupportEmailSummary[];
  nextPageToken: string | null;
  resultSizeEstimate: number;
  supportEmail: string;
};

export class GmailConfigurationError extends Error {
  missing: string[];
  supportEmail: string;

  constructor(missing: string[], supportEmail: string) {
    super("La integración de Gmail no está configurada.");
    this.name = "GmailConfigurationError";
    this.missing = missing;
    this.supportEmail = supportEmail;
  }
}

export function isGmailConfigurationError(error: unknown): error is GmailConfigurationError {
  return error instanceof GmailConfigurationError;
}

export class GmailApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GmailApiError";
    this.status = status;
  }
}

export function isGmailApiError(error: unknown): error is GmailApiError {
  return error instanceof GmailApiError;
}

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getGmailSetupStatus() {
  const supportEmail = readEnv("GMAIL_SUPPORT_EMAIL") || DEFAULT_SUPPORT_EMAIL;
  const required = [
    "GMAIL_OAUTH_CLIENT_ID",
    "GMAIL_OAUTH_CLIENT_SECRET",
    "GMAIL_OAUTH_REFRESH_TOKEN",
  ];
  const missing = required.filter((name) => !readEnv(name));

  return {
    configured: missing.length === 0,
    missing,
    supportEmail,
  };
}

function getConfig(): GmailConfig {
  const status = getGmailSetupStatus();
  if (!status.configured) {
    throw new GmailConfigurationError(status.missing, status.supportEmail);
  }

  return {
    clientId: readEnv("GMAIL_OAUTH_CLIENT_ID"),
    clientSecret: readEnv("GMAIL_OAUTH_CLIENT_SECRET"),
    refreshToken: readEnv("GMAIL_OAUTH_REFRESH_TOKEN"),
    supportEmail: status.supportEmail,
    supportQuery: readEnv("GMAIL_SUPPORT_QUERY") || DEFAULT_SUPPORT_QUERY,
  };
}

function getHeader(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromPayload(payload: GmailPayloadPart | undefined): string {
  if (!payload) return "";
  const data = payload.body?.data;

  if (data && payload.mimeType === "text/plain") {
    return decodeBase64Url(data).trim();
  }

  const plainPart = payload.parts?.map(textFromPayload).find(Boolean);
  if (plainPart) return plainPart;

  if (data && payload.mimeType === "text/html") {
    return stripHtml(decodeBase64Url(data));
  }

  return "";
}

function normalizeDate(value: string, fallbackInternalDate?: string) {
  const fromHeader = value ? new Date(value) : null;
  if (fromHeader && !Number.isNaN(fromHeader.getTime())) return fromHeader.toISOString();

  const timestamp = Number(fallbackInternalDate);
  if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString();

  return new Date().toISOString();
}

async function getAccessToken(config: GmailConfig) {
  const response = await fetch(TOKEN_ENDPOINT, {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const payload = (await response.json().catch(() => ({}))) as GmailTokenResponse;
  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || "No fue posible obtener acceso a Gmail.";
    throw new Error(message);
  }

  return payload.access_token;
}

async function gmailRequest<T>(path: string, accessToken: string) {
  return gmailJsonRequest<T>(path, accessToken);
}

async function gmailJsonRequest<T>(path: string, accessToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new GmailApiError(payload || "No fue posible consultar Gmail.", response.status);
  }

  return (await response.json()) as T;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeMimeHeader(value: string) {
  const clean = sanitizeHeaderValue(value);
  return /[^\x20-\x7E]/.test(clean)
    ? `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`
    : clean;
}

function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^>]+)>/);
  const email = angleMatch?.[1] ?? value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  return sanitizeHeaderValue(email.toLowerCase());
}

function replySubject(subject: string) {
  const cleanSubject = sanitizeHeaderValue(subject || "(Sin asunto)");
  return /^re:/i.test(cleanSubject) ? cleanSubject : `Re: ${cleanSubject}`;
}

function buildReplyMime({
  body,
  from,
  messageIdHeader,
  references,
  subject,
  to,
}: {
  body: string;
  from: string;
  messageIdHeader: string;
  references: string;
  subject: string;
  to: string;
}) {
  const referenceHeader = [references, messageIdHeader].filter(Boolean).join(" ").trim();
  const headers = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${encodeMimeHeader(replySubject(subject))}`,
    messageIdHeader ? `In-Reply-To: ${sanitizeHeaderValue(messageIdHeader)}` : "",
    referenceHeader ? `References: ${sanitizeHeaderValue(referenceHeader)}` : "",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "Content-Transfer-Encoding: 8bit",
  ].filter((line) => line !== "");

  return `${headers.join("\r\n")}\r\n\r\n${body.trim()}`;
}

function buildPlainEmailMime({
  body,
  from,
  subject,
  to,
}: {
  body: string;
  from: string;
  subject: string;
  to: string;
}) {
  const headers = [
    `To: ${sanitizeHeaderValue(to)}`,
    `From: ${sanitizeHeaderValue(from)}`,
    `Subject: ${encodeMimeHeader(subject || "(Sin asunto)")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "Content-Transfer-Encoding: 8bit",
  ];

  return `${headers.join("\r\n")}\r\n\r\n${body.trim()}`;
}

function messageFromResponse(message: GmailMessageResponse): SupportEmailSummary {
  const headers = message.payload?.headers;
  const subject = getHeader(headers, "Subject") || "(Sin asunto)";
  const from = getHeader(headers, "From") || "Remitente desconocido";
  const date = normalizeDate(getHeader(headers, "Date"), message.internalDate);
  const labels = message.labelIds ?? [];

  return {
    date,
    from,
    id: message.id ?? "",
    labels,
    snippet: message.snippet ?? "",
    subject,
    threadId: message.threadId ?? "",
    unread: labels.includes("UNREAD"),
  };
}

export async function listSupportMessages({
  maxResults = 10,
  pageToken,
  query,
}: {
  maxResults?: number;
  pageToken?: string;
  query?: string;
} = {}): Promise<SupportInboxResult> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const params = new URLSearchParams({
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    q: query?.trim() || config.supportQuery,
  });
  if (pageToken) params.set("pageToken", pageToken);

  const list = await gmailRequest<GmailListResponse>(`/messages?${params.toString()}`, accessToken);
  const messages = await Promise.all(
    (list.messages ?? [])
      .filter((message): message is { id: string; threadId?: string } => Boolean(message.id))
      .map((message) => {
        const detailParams = new URLSearchParams({
          format: "metadata",
          metadataHeaders: "From",
        });
        detailParams.append("metadataHeaders", "Subject");
        detailParams.append("metadataHeaders", "Date");
        return gmailRequest<GmailMessageResponse>(`/messages/${encodeURIComponent(message.id)}?${detailParams.toString()}`, accessToken);
      }),
  );

  return {
    messages: messages.map(messageFromResponse),
    nextPageToken: list.nextPageToken ?? null,
    resultSizeEstimate: list.resultSizeEstimate ?? messages.length,
    supportEmail: config.supportEmail,
  };
}

export async function getSupportMessage(messageId: string): Promise<SupportEmailDetail> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const message = await gmailRequest<GmailMessageResponse>(
    `/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken,
  );
  const summary = messageFromResponse(message);
  const headers = message.payload?.headers;

  return {
    ...summary,
    body: textFromPayload(message.payload) || summary.snippet || "Este correo no contiene texto legible.",
    messageIdHeader: getHeader(headers, "Message-ID"),
    references: getHeader(headers, "References"),
    replyTo: getHeader(headers, "Reply-To"),
  };
}

export async function sendSupportReply(messageId: string, body: string): Promise<SupportReplyResult> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  const original = await gmailRequest<GmailMessageResponse>(
    `/messages/${encodeURIComponent(messageId)}?format=full`,
    accessToken,
  );
  const summary = messageFromResponse(original);
  const headers = original.payload?.headers;
  const replyTarget = extractEmailAddress(getHeader(headers, "Reply-To") || getHeader(headers, "From"));

  if (!replyTarget) {
    throw new Error("No fue posible identificar el correo del remitente.");
  }

  const raw = encodeBase64Url(buildReplyMime({
    body,
    from: config.supportEmail,
    messageIdHeader: getHeader(headers, "Message-ID"),
    references: getHeader(headers, "References"),
    subject: summary.subject,
    to: replyTarget,
  }));

  const sent = await gmailJsonRequest<{ id?: string; threadId?: string }>("/messages/send", accessToken, {
    body: JSON.stringify({
      raw,
      threadId: original.threadId,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  return {
    id: sent.id ?? "",
    threadId: sent.threadId ?? original.threadId ?? "",
  };
}

export async function sendSupportEmail({ body, subject, to }: SupportOutboundEmail): Promise<SupportReplyResult> {
  const config = getConfig();
  const recipient = extractEmailAddress(to);

  if (!recipient) {
    throw new Error("No fue posible identificar el correo destinatario.");
  }

  const accessToken = await getAccessToken(config);
  const raw = encodeBase64Url(buildPlainEmailMime({
    body,
    from: config.supportEmail,
    subject,
    to: recipient,
  }));

  const sent = await gmailJsonRequest<{ id?: string; threadId?: string }>("/messages/send", accessToken, {
    body: JSON.stringify({ raw }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  return {
    id: sent.id ?? "",
    threadId: sent.threadId ?? "",
  };
}
