-- Phase 4: two admin-editable cheat sheets — the "before you leave" closeout
-- checklist and the inventory refills list. Three display fields
-- (name / description / helper) + ordering + an active flag. Cleaners read them;
-- only admins write. Seeded from the app (a "Load starter items" action), not
-- here, to avoid hand-escaping content in SQL.
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  helper text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  helper text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.checklist_items enable row level security;
alter table public.inventory_items enable row level security;

grant select, insert, update, delete on public.checklist_items to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.checklist_items to service_role;
grant select, insert, update, delete on public.inventory_items to service_role;

-- Readable by any authenticated user (cleaners see the cheat sheets).
drop policy if exists "checklist readable" on public.checklist_items;
create policy "checklist readable"
  on public.checklist_items for select to authenticated using (true);
drop policy if exists "inventory readable" on public.inventory_items;
create policy "inventory readable"
  on public.inventory_items for select to authenticated using (true);

-- Only admins create / edit / delete.
drop policy if exists "admins write checklist" on public.checklist_items;
create policy "admins write checklist"
  on public.checklist_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins write inventory" on public.inventory_items;
create policy "admins write inventory"
  on public.inventory_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
