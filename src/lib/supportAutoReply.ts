import "server-only";

import { sendSupportReply, type SupportEmailSummary } from "@/lib/gmailSupport";
import {
  ensureSupportReviewStorage,
  getSupportReviewMap,
  isSupportReviewTableMissingError,
  markSupportAutoReplyAttempt,
} from "@/lib/supportReviews";

const AUTO_REPLY_RETRY_WINDOW_MS = 10 * 60 * 1000;

function shouldRetry(lastAttemptAt: string | null) {
  if (!lastAttemptAt) return true;
  const lastAttempt = new Date(lastAttemptAt).getTime();
  if (Number.isNaN(lastAttempt)) return true;
  return Date.now() - lastAttempt > AUTO_REPLY_RETRY_WINDOW_MS;
}

function canAutoReplyTo(message: SupportEmailSummary) {
  const from = message.from.toLowerCase();
  return message.unread && !from.includes("no-reply") && !from.includes("noreply");
}

export async function sendPendingSupportAutoReplies({
  body,
  messages,
}: {
  body: string;
  messages: SupportEmailSummary[];
}) {
  const cleanBody = body.trim();
  if (!cleanBody || !messages.length) return;

  try {
    await ensureSupportReviewStorage();
  } catch (error) {
    if (isSupportReviewTableMissingError(error)) return;
    throw error;
  }

  const reviewMap = await getSupportReviewMap(messages.map((message) => message.id));

  for (const message of messages) {
    if (!canAutoReplyTo(message)) continue;

    const review = reviewMap.get(message.id);
    if (review?.autoReplySentAt || !shouldRetry(review?.autoReplyLastAttemptAt ?? null)) continue;

    try {
      const sent = await sendSupportReply(message.id, cleanBody);
      await markSupportAutoReplyAttempt({
        messageId: message.id,
        sent: true,
        threadId: sent.threadId || message.threadId,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "No fue posible enviar el acuse automático.";
      await markSupportAutoReplyAttempt({
        errorMessage: messageText,
        messageId: message.id,
        sent: false,
        threadId: message.threadId,
      }).catch(() => null);
      console.error("Error al enviar acuse automático de aclaración:", messageText);
    }
  }
}
