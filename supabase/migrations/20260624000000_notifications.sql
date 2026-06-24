-- Phase 3: notification outbox (spec Section 4.1 / 5.4). Channel-agnostic.
-- Correctness lives in the schedule; notifications are a convenience layer, so
-- this table is designed to be idempotent: `dedupe_key` is unique, and the
-- enqueue does INSERT ... ON CONFLICT (dedupe_key) DO NOTHING. A sender process
-- moves rows pending -> sent/failed. System (service_role) writes; a recipient
-- reads and marks their own read.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,                       -- new | cancelled | date_changed | became_same_day | reminder | payment_sent
  channel text not null default 'email' check (channel in ('in_app', 'email', 'web_push')),
  turnover_id uuid references public.turnovers (id) on delete cascade,
  title text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'read')),
  dedupe_key text not null unique,          -- makes enqueue idempotent
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, status);
create index if not exists notifications_status_idx
  on public.notifications (status);

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to service_role;
grant select, update on public.notifications to authenticated;

-- A recipient sees only their own notifications (for the in-app inbox).
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications"
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

-- A recipient may mark their own read (status update); the system does the rest.
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications"
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
