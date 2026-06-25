-- Phase 5: linen tracking (Section 5.9). Individual sheet/duvet sets, each with
-- a state and (when out) who holds it. Everyone reads + updates state/holder
-- (cleaners move linens around); only admins add/remove sets. Other supplies are
-- intentionally not tracked here.
create table if not exists public.linen_sets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sheet_set', 'duvet_set')),
  label text not null,
  color text,
  brand text,
  state text not null default 'clean_backup'
    check (state in ('on_beds', 'with_cleaner', 'clean_backup', 'in_wash')),
  held_by uuid references public.profiles (id),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.linen_sets enable row level security;

grant select, insert, update, delete on public.linen_sets to authenticated;
grant select, insert, update, delete on public.linen_sets to service_role;

drop policy if exists "linens readable" on public.linen_sets;
create policy "linens readable"
  on public.linen_sets for select to authenticated using (true);

-- Anyone can move a set between states / holders (operational).
drop policy if exists "linens updatable" on public.linen_sets;
create policy "linens updatable"
  on public.linen_sets for update to authenticated using (true) with check (true);

-- Only admins add / remove sets from the inventory.
drop policy if exists "admins add linens" on public.linen_sets;
create policy "admins add linens"
  on public.linen_sets for insert to authenticated with check (public.is_admin());
drop policy if exists "admins remove linens" on public.linen_sets;
create policy "admins remove linens"
  on public.linen_sets for delete to authenticated using (public.is_admin());
