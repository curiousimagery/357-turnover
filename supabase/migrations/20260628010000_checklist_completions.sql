-- Per-turnover closeout checklist ticks. The "before you leave" checklist was a
-- reference list whose ticks lived only in the browser session; this records them
-- against the turnover so they survive a reload and the admin can see what was
-- actually checked. One row per ticked (turnover, item); unticking deletes it.
create table if not exists public.turnover_checklist_completions (
  turnover_id uuid not null references public.turnovers (id) on delete cascade,
  item_id uuid not null references public.checklist_items (id) on delete cascade,
  checked_by uuid references public.profiles (id),
  checked_at timestamptz not null default now(),
  primary key (turnover_id, item_id)
);

alter table public.turnover_checklist_completions enable row level security;

grant select, insert, update, delete on public.turnover_checklist_completions to authenticated;
grant select, insert, update, delete on public.turnover_checklist_completions to service_role;

-- Admin sees all; the assigned cleaner sees their own turnover's ticks. (Writes
-- go through the service role after the server action gates — these are the
-- backstop, matching the rest of the turnover-scoped tables.)
drop policy if exists "read checklist completions" on public.turnover_checklist_completions;
create policy "read checklist completions"
  on public.turnover_checklist_completions for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = turnover_checklist_completions.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  );

-- Admin or the assigned cleaner may tick / untick on that turnover.
drop policy if exists "write checklist completions" on public.turnover_checklist_completions;
create policy "write checklist completions"
  on public.turnover_checklist_completions for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = turnover_checklist_completions.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = turnover_checklist_completions.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  );
