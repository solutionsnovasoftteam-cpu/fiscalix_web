import "server-only";

import { sendSupportReply, type SupportEmailSummary } from "@/lib/gmailSupport";
import {
  ensureSupportReviewStorage,
  getSupportReviewMap,
  isSupportReviewTableMissingError,
  markSupportAutoReplyAttempt,
} from "@/lib/supportReviews";

const AUTO_REPLY_RETRY_WINDOW_MS = 10 * 60 * 1000;

export type SupportAutoReplyStats = {
  failed: number;
  scanned: number;
  sent: number;
  skipped: number;
};

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
}): Promise<SupportAutoReplyStats> {
  const stats: SupportAutoReplyStats = {
    failed: 0,
    scanned: messages.length,
    sent: 0,
    skipped: 0,
  };
  const cleanBody = body.trim();
  if (!cleanBody || !messages.length) {
    stats.skipped = messages.length;
    return stats;
  }

  try {
    await ensureSupportReviewStorage();
  } catch (error) {
    if (isSupportReviewTableMissingError(error)) {
      stats.skipped = messages.length;
      return stats;
    }
    throw error;
  }

  const reviewMap = await getSupportReviewMap(messages.map((message) => message.id));

  for (const message of messages) {
    if (!canAutoReplyTo(message)) {
      stats.skipped += 1;
      continue;
    }

    const review = reviewMap.get(message.id);
    if (review?.autoReplySentAt || !shouldRetry(review?.autoReplyLastAttemptAt ?? null)) {
      stats.skipped += 1;
      continue;
    }

    try {
      const sent = await sendSupportReply(message.id, cleanBody);
      await markSupportAutoReplyAttempt({
        messageId: message.id,
        sent: true,
        threadId: sent.threadId || message.threadId,
      });
      stats.sent += 1;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "No fue posible enviar el acuse automático.";
      await markSupportAutoReplyAttempt({
        errorMessage: messageText,
        messageId: message.id,
        sent: false,
        threadId: message.threadId,
      }).catch(() => null);
      stats.failed += 1;
      console.error("Error al enviar acuse automático de aclaración:", messageText);
    }
  }

  return stats;
}
