-- Supply / inventory "running low" notes (spec 5.7–5.8). Cleaners flag what's low
-- at closeout (or from a turnover page); the admin sees them all in one place and
-- marks them restocked. A note usually hangs off a turnover (so it carries the
-- visit context), but the admin can also file a standalone one (turnover_id null,
-- e.g. "guest said the first-aid kit is empty"), so the column is nullable.
create table if not exists public.supply_notes (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid references public.turnovers (id) on delete cascade,
  author_id uuid references public.profiles (id),
  body text not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists supply_notes_turnover_idx
  on public.supply_notes (turnover_id);
-- The /supplies admin view reads the open ones first.
create index if not exists supply_notes_open_idx
  on public.supply_notes (resolved, created_at desc);

alter table public.supply_notes enable row level security;

grant select, insert, update, delete on public.supply_notes to authenticated;
grant select, insert, update, delete on public.supply_notes to service_role;

-- Admin reads all; a cleaner reads notes they wrote or ones on a turnover they're
-- assigned to. (Writes in the app go through the service role after the server
-- action gates, mirroring prep notes / closeout; these policies are the backstop.)
drop policy if exists "read supply notes" on public.supply_notes;
create policy "read supply notes"
  on public.supply_notes for select to authenticated
  using (
    public.is_admin()
    or author_id = (select auth.uid())
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = supply_notes.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  );

-- A cleaner may file a note as themselves on a turnover they're assigned to;
-- an admin may file any note (incl. standalone, turnover_id null).
drop policy if exists "file supply note" on public.supply_notes;
create policy "file supply note"
  on public.supply_notes for insert to authenticated
  with check (
    public.is_admin()
    or (
      author_id = (select auth.uid())
      and turnover_id is not null
      and exists (
        select 1 from public.turnover_assignments ta
        where ta.turnover_id = supply_notes.turnover_id
          and ta.cleaner_id = (select auth.uid())
      )
    )
  );

-- Only an admin resolves (marks restocked) or removes notes.
drop policy if exists "admins resolve supply notes" on public.supply_notes;
create policy "admins resolve supply notes"
  on public.supply_notes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete supply notes" on public.supply_notes;
create policy "admins delete supply notes"
  on public.supply_notes for delete to authenticated
  using (public.is_admin());
