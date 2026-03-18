-- Notify email signup storage for the lightweight retention form.
-- Used by POST /api/notify via the server-side Supabase service role client.

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.notify_emails (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  created_at timestamptz not null default now(),
  source text not null default 'website',
  metadata jsonb not null default '{}'::jsonb
);
