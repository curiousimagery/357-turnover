-- Linen redesign (Section 5.9, v1). Replaces the per-set state machine
-- (`linen_sets`) with a count-based inventory whose locations are *derived*, so
-- they always reconcile to the owned count and there are no bogus low-stock
-- warnings. Three tables:
--   * linen_types     — the inventory: each type (kind + label) and how many owned.
--   * turnover_linens — the closeout record: which sheet/duvet type is on each of
--                       the 2 beds. The latest across the unit = current "on beds".
--   * linen_holdings  — what each person has out to wash; restock clears it.
-- See lib/linens/derive.ts for the location math.
--
-- None of the old per-set data is worth keeping (Daniel confirmed), so drop the
-- old table outright.
drop table if exists public.linen_sets cascade;

-- The inventory. Admin CRUD; everyone reads.
create table if not exists public.linen_types (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sheet_set', 'duvet_set')),
  label text not null,
  count integer not null default 1 check (count >= 0),
  created_at timestamptz not null default now()
);

-- What's on each of the 2 beds, recorded at closeout. One row per (turnover, bed).
create table if not exists public.turnover_linens (
  turnover_id uuid not null references public.turnovers (id) on delete cascade,
  bed smallint not null check (bed in (1, 2)),
  -- Keep history readable if a type is later deleted: null it out, don't cascade.
  sheet_type_id uuid references public.linen_types (id) on delete set null,
  duvet_type_id uuid references public.linen_types (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (turnover_id, bed)
);
-- "Latest on beds" walks this by recency.
create index if not exists turnover_linens_recent_idx
  on public.turnover_linens (created_at desc);

-- What each person currently has out to wash, aggregated per (type, holder).
create table if not exists public.linen_holdings (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.linen_types (id) on delete cascade,
  holder_id uuid not null references public.profiles (id) on delete cascade,
  qty integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (type_id, holder_id)
);

alter table public.linen_types enable row level security;
alter table public.turnover_linens enable row level security;
alter table public.linen_holdings enable row level security;

grant select, insert, update, delete on public.linen_types to authenticated;
grant select, insert, update, delete on public.linen_types to service_role;
grant select, insert, update, delete on public.turnover_linens to authenticated;
grant select, insert, update, delete on public.turnover_linens to service_role;
grant select, insert, update, delete on public.linen_holdings to authenticated;
grant select, insert, update, delete on public.linen_holdings to service_role;

-- linen_types: everyone reads the inventory; only admins change it.
drop policy if exists "read linen types" on public.linen_types;
create policy "read linen types"
  on public.linen_types for select to authenticated using (true);
drop policy if exists "admins write linen types" on public.linen_types;
create policy "admins write linen types"
  on public.linen_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- turnover_linens: everyone reads (what's on the beds is shared knowledge). The
-- app writes through the service role after the action gates to admin / the
-- assigned cleaner; this policy is the backstop matching the other turnover tables.
drop policy if exists "read turnover linens" on public.turnover_linens;
create policy "read turnover linens"
  on public.turnover_linens for select to authenticated using (true);
drop policy if exists "write turnover linens" on public.turnover_linens;
create policy "write turnover linens"
  on public.turnover_linens for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = turnover_linens.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.turnover_assignments ta
      where ta.turnover_id = turnover_linens.turnover_id
        and ta.cleaner_id = (select auth.uid())
    )
  );

-- linen_holdings: everyone reads (the breakdown shows who has what). A holder may
-- clear their own (restock); the admin may clear anyone's. Writes from closeout go
-- through the service role.
drop policy if exists "read linen holdings" on public.linen_holdings;
create policy "read linen holdings"
  on public.linen_holdings for select to authenticated using (true);
drop policy if exists "write linen holdings" on public.linen_holdings;
create policy "write linen holdings"
  on public.linen_holdings for all to authenticated
  using (public.is_admin() or holder_id = (select auth.uid()))
  with check (public.is_admin() or holder_id = (select auth.uid()));
