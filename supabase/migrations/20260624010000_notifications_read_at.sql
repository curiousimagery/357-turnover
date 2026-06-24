-- Phase 3: in-app inbox. Track "read" separately from the email-delivery
-- `status` (pending/sent/failed) so the two never conflict — a notification can
-- be sent by email AND still unread in the app, or read in the app before the
-- email even goes out. Unread = read_at is null.
alter table public.notifications
  add column if not exists read_at timestamptz;

-- Fast unread-count for the header badge.
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;
