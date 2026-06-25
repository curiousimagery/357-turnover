-- Phase 4: let users declutter their inbox. Archived notifications stay in the
-- table (history) but drop out of the inbox + badge.
alter table public.notifications
  add column if not exists archived_at timestamptz;
