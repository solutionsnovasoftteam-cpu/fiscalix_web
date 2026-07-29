create table if not exists public.support_message_reviews (
  message_id text primary key,
  thread_id text,
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by varchar references public.usuarios(id) on delete set null,
  auto_reply_sent_at timestamptz,
  auto_reply_last_attempt_at timestamptz,
  auto_reply_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_message_reviews
  add column if not exists auto_reply_sent_at timestamptz,
  add column if not exists auto_reply_last_attempt_at timestamptz,
  add column if not exists auto_reply_error text;

create index if not exists support_message_reviews_reviewed_idx
  on public.support_message_reviews (reviewed);

create index if not exists support_message_reviews_reviewed_at_idx
  on public.support_message_reviews (reviewed_at desc);

create index if not exists support_message_reviews_auto_reply_sent_at_idx
  on public.support_message_reviews (auto_reply_sent_at desc);
