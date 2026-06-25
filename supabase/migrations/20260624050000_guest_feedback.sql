-- Phase 4: guest feedback the cleaner leaves at closeout to help the admin rate
-- the guest. A 5-star cleanliness + a free note, tied to the turnover. Visible
-- to the admin and the person who wrote it.
create table if not exists public.guest_feedback (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null references public.turnovers (id) on delete cascade,
  cleanliness int check (cleanliness between 1 and 5),
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists guest_feedback_turnover_idx
  on public.guest_feedback (turnover_id);

alter table public.guest_feedback enable row level security;

grant select, insert, update, delete on public.guest_feedback to authenticated;
grant select, insert, update, delete on public.guest_feedback to service_role;

-- Admin reads all; a cleaner reads what they wrote.
drop policy if exists "read guest feedback" on public.guest_feedback;
create policy "read guest feedback"
  on public.guest_feedback for select to authenticated
  using (public.is_admin() or created_by = (select auth.uid()));

-- A user may file their own feedback.
drop policy if exists "file own guest feedback" on public.guest_feedback;
create policy "file own guest feedback"
  on public.guest_feedback for insert to authenticated
  with check (created_by = (select auth.uid()));
