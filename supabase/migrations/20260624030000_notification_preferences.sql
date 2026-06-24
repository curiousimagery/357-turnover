-- Phase 4: per-user notification preferences. One row per (user, type) with two
-- channel switches. Missing row = both on (opt-out model). The sender skips
-- email when email=false; the inbox/badge hide types where in_app=false.
create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  in_app boolean not null default true,
  email boolean not null default true,
  primary key (user_id, type)
);

alter table public.notification_preferences enable row level security;

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.notification_preferences to service_role;

-- A user manages only their own preferences.
drop policy if exists "manage own notification prefs" on public.notification_preferences;
create policy "manage own notification prefs"
  on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
