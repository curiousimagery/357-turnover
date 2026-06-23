-- Phase 2: claiming. Who is doing each turnover (Section 4.1 / 5.3).
-- The unique(turnover_id) constraint is the core safety rule: it makes
-- double-coverage impossible at the database level. A second simultaneous
-- claim fails on the constraint, and the app shows "already claimed".
-- Payment fields (amount/paid_at) and bedding_taken come in later phases.

create table if not exists public.turnover_assignments (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null references public.turnovers (id) on delete cascade,
  cleaner_id uuid not null references public.profiles (id),
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (turnover_id)
);
create index if not exists turnover_assignments_cleaner_idx
  on public.turnover_assignments (cleaner_id);

alter table public.turnover_assignments enable row level security;

grant select, insert, update, delete on public.turnover_assignments to authenticated;
grant select, insert, update, delete on public.turnover_assignments to service_role;

-- Everyone authenticated can see who claimed what (drives the cleaner tags on
-- the schedule and prevents two people grabbing the same date).
drop policy if exists "assignments readable by authenticated" on public.turnover_assignments;
create policy "assignments readable by authenticated"
  on public.turnover_assignments for select to authenticated using (true);

-- A cleaner may claim for themselves; an admin may assign anyone (incl. self).
drop policy if exists "claim own or admin assigns" on public.turnover_assignments;
create policy "claim own or admin assigns"
  on public.turnover_assignments for insert to authenticated
  with check (cleaner_id = (select auth.uid()) or public.is_admin());

-- A cleaner may release their own; an admin may unassign anyone.
drop policy if exists "unclaim own or admin unassigns" on public.turnover_assignments;
create policy "unclaim own or admin unassigns"
  on public.turnover_assignments for delete to authenticated
  using (cleaner_id = (select auth.uid()) or public.is_admin());

-- Only an admin can edit an existing assignment row (reassign).
drop policy if exists "admins update assignments" on public.turnover_assignments;
create policy "admins update assignments"
  on public.turnover_assignments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
