-- Phase 6: payment tracking (Section 5.11). A per-turnover payment record with a
-- privacy boundary — a cleaner sees only their own; the admin sees all. Amounts
-- live in their own table (not on the publicly-readable profiles/assignments) so
-- they stay private. Each cleaner has a default rate; a turnover can override it.

-- Default rate per cleaner. Its own table (not profiles, which is world-readable)
-- so rates stay private: admin + the cleaner themselves.
create table if not exists public.cleaner_rates (
  cleaner_id uuid primary key references public.profiles (id) on delete cascade,
  default_rate numeric(10, 2),
  updated_at timestamptz not null default now()
);
alter table public.cleaner_rates enable row level security;
grant select, insert, update, delete on public.cleaner_rates to authenticated;
grant select, insert, update, delete on public.cleaner_rates to service_role;
drop policy if exists "read cleaner rate" on public.cleaner_rates;
create policy "read cleaner rate"
  on public.cleaner_rates for select to authenticated
  using (public.is_admin() or cleaner_id = (select auth.uid()));
drop policy if exists "admins write cleaner rate" on public.cleaner_rates;
create policy "admins write cleaner rate"
  on public.cleaner_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  turnover_id uuid not null unique references public.turnovers (id) on delete cascade,
  cleaner_id uuid not null references public.profiles (id),
  amount numeric(10, 2),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payments_cleaner_idx on public.payments (cleaner_id);

alter table public.payments enable row level security;

grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.payments to service_role;

-- Admin reads all; a cleaner reads only their own.
drop policy if exists "read payments" on public.payments;
create policy "read payments"
  on public.payments for select to authenticated
  using (public.is_admin() or cleaner_id = (select auth.uid()));

-- Only admins write payments.
drop policy if exists "admins write payments" on public.payments;
create policy "admins write payments"
  on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
