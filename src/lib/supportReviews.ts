import "server-only";

import { supabase } from "@/lib/supabase";

const SUPPORT_REVIEW_TABLE = "support_message_reviews";

export type SupportReviewStatus = {
  autoReplyError: string | null;
  autoReplyLastAttemptAt: string | null;
  autoReplySentAt: string | null;
  reviewed: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
};

type SupportReviewRow = {
  auto_reply_error: string | null;
  auto_reply_last_attempt_at: string | null;
  auto_reply_sent_at: string | null;
  message_id: string;
  reviewed: boolean | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

export class SupportReviewTableMissingError extends Error {
  constructor() {
    super("La tabla support_message_reviews no existe.");
    this.name = "SupportReviewTableMissingError";
  }
}

export function isSupportReviewTableMissingError(error: unknown): error is SupportReviewTableMissingError {
  return error instanceof SupportReviewTableMissingError;
}

function isMissingReviewTableError(error: SupabaseErrorLike | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("auto_reply") && (
      message.includes("could not find") ||
      message.includes("schema cache") ||
      message.includes("does not exist")
    )) ||
    (message.includes(SUPPORT_REVIEW_TABLE) && (
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache")
    ))
  );
}

function normalizeReview(row?: SupportReviewRow | null): SupportReviewStatus {
  return {
    autoReplyError: row?.auto_reply_error ?? null,
    autoReplyLastAttemptAt: row?.auto_reply_last_attempt_at ?? null,
    autoReplySentAt: row?.auto_reply_sent_at ?? null,
    reviewed: row?.reviewed === true,
    reviewedAt: row?.reviewed_at ?? null,
    reviewedBy: row?.reviewed_by ?? null,
  };
}

export async function getSupportReviewMap(messageIds: string[]) {
  const uniqueIds = Array.from(new Set(messageIds.map((id) => id.trim()).filter(Boolean)));
  const reviewMap = new Map<string, SupportReviewStatus>();
  if (!uniqueIds.length) return reviewMap;

  const { data, error } = await supabase
    .from(SUPPORT_REVIEW_TABLE)
    .select("message_id,reviewed,reviewed_at,reviewed_by,auto_reply_sent_at,auto_reply_last_attempt_at,auto_reply_error")
    .in("message_id", uniqueIds);

  if (error) {
    if (isMissingReviewTableError(error)) return reviewMap;
    throw error;
  }

  for (const row of (data ?? []) as SupportReviewRow[]) {
    reviewMap.set(row.message_id, normalizeReview(row));
  }

  return reviewMap;
}

export async function getSupportReviewStatus(messageId: string) {
  const id = messageId.trim();
  if (!id) return normalizeReview();

  const { data, error } = await supabase
    .from(SUPPORT_REVIEW_TABLE)
    .select("message_id,reviewed,reviewed_at,reviewed_by,auto_reply_sent_at,auto_reply_last_attempt_at,auto_reply_error")
    .eq("message_id", id)
    .maybeSingle();

  if (error) {
    if (isMissingReviewTableError(error)) return normalizeReview();
    throw error;
  }

  return normalizeReview(data as SupportReviewRow | null);
}

export async function withSupportReviewStatus<T extends { id: string }>(messages: T[]) {
  const reviewMap = await getSupportReviewMap(messages.map((message) => message.id));
  return messages.map((message) => ({
    ...message,
    ...normalizeReview(),
    ...(reviewMap.get(message.id) ?? {}),
  }));
}

export async function setSupportMessageReviewed({
  messageId,
  reviewed,
  reviewedBy,
  threadId,
}: {
  messageId: string;
  reviewed: boolean;
  reviewedBy: string;
  threadId?: string | null;
}) {
  const id = messageId.trim();
  if (!id) return normalizeReview();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(SUPPORT_REVIEW_TABLE)
    .upsert({
      message_id: id,
      reviewed,
      reviewed_at: reviewed ? now : null,
      reviewed_by: reviewed ? reviewedBy : null,
      thread_id: threadId?.trim() || null,
      updated_at: now,
    }, { onConflict: "message_id" })
    .select("message_id,reviewed,reviewed_at,reviewed_by,auto_reply_sent_at,auto_reply_last_attempt_at,auto_reply_error")
    .single();

  if (error) {
    if (isMissingReviewTableError(error)) throw new SupportReviewTableMissingError();
    throw error;
  }

  return normalizeReview(data as SupportReviewRow);
}

export async function ensureSupportReviewStorage() {
  const { error } = await supabase
    .from(SUPPORT_REVIEW_TABLE)
    .select("message_id,auto_reply_sent_at,auto_reply_last_attempt_at,auto_reply_error")
    .limit(1);

  if (error) {
    if (isMissingReviewTableError(error)) throw new SupportReviewTableMissingError();
    throw error;
  }
}

export async function markSupportAutoReplyAttempt({
  errorMessage,
  messageId,
  sent,
  threadId,
}: {
  errorMessage?: string | null;
  messageId: string;
  sent: boolean;
  threadId?: string | null;
}) {
  const id = messageId.trim();
  if (!id) return normalizeReview();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(SUPPORT_REVIEW_TABLE)
    .upsert({
      auto_reply_error: sent ? null : (errorMessage?.slice(0, 500) || "No fue posible enviar el acuse automático."),
      auto_reply_last_attempt_at: now,
      auto_reply_sent_at: sent ? now : null,
      message_id: id,
      thread_id: threadId?.trim() || null,
      updated_at: now,
    }, { onConflict: "message_id" })
    .select("message_id,reviewed,reviewed_at,reviewed_by,auto_reply_sent_at,auto_reply_last_attempt_at,auto_reply_error")
    .single();

  if (error) {
    if (isMissingReviewTableError(error)) throw new SupportReviewTableMissingError();
    throw error;
  }

  return normalizeReview(data as SupportReviewRow);
}
