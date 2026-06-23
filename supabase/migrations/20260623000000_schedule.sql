-- Phase 1: bookings, turnovers, and sync observability (read-only schedule).
-- Mirrors DATA_MODEL.md (Section 4). System (service role) writes; users read.
-- Idempotent so it can be re-run safely (dashboard SQL Editor or db push).

-- ---------------------------------------------------------------------------
-- bookings: raw reservations from the feed (never blocks). Admin-only read.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  uid text unique not null,                 -- stable UID from the iCal event
  check_in date not null,
  check_out date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  raw_summary text,                          -- expected 'Reserved'
  reservation_url text,                      -- admin-only click-through
  -- the feed also carries a guest phone last-4; we deliberately never store it
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- turnovers: the operational unit. Derived from checkouts (airbnb) or manual.
-- ---------------------------------------------------------------------------
create table if not exists public.turnovers (
  id uuid primary key default gen_random_uuid(),
  turnover_date date not null,
  source text not null check (source in ('airbnb', 'manual')),
  booking_out_id uuid references public.bookings (id),  -- the checkout that creates it
  booking_in_id uuid references public.bookings (id),   -- the same-day check-in, if any
  is_same_day boolean not null default false,           -- recomputed every sync
  status text not null default 'scheduled'
    check (status in ('scheduled', 'claimed', 'completed', 'cancelled')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists turnovers_turnover_date_idx
  on public.turnovers (turnover_date);
-- One airbnb turnover per checkout booking — makes derivation idempotent and
-- gives the sync upsert an ON CONFLICT target. A plain (non-partial) unique
-- index is required for ON CONFLICT; NULL booking_out_id (manual turnovers) are
-- distinct under a unique index, so multiple manual turnovers are still allowed.
create unique index if not exists turnovers_booking_out_unique
  on public.turnovers (booking_out_id);

-- ---------------------------------------------------------------------------
-- sync observability + heartbeat.
-- ---------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed', 'skipped')),
  added int default 0,
  changed int default 0,
  cancelled int default 0,
  error text
);

create table if not exists public.sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_at timestamptz,
  last_success_at timestamptz
);
insert into public.sync_state (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS (Section 4.2). Writes are system-only — the service role bypasses RLS,
-- so we add no write policies for normal users (denied by default).
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;
alter table public.turnovers enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_state enable row level security;

-- Table-level grants. RLS still governs which *rows* each role sees; these grant
-- the role table access at all (required in addition to policies). Explicit so
-- local and hosted behave identically regardless of default-privilege setup.
grant select on
  public.bookings, public.turnovers, public.sync_runs, public.sync_state
  to authenticated;
grant select, insert, update, delete on
  public.bookings, public.turnovers, public.sync_runs, public.sync_state
  to service_role;

-- turnovers: readable by any authenticated user (cleaners + admin).
drop policy if exists "turnovers readable by authenticated" on public.turnovers;
create policy "turnovers readable by authenticated"
  on public.turnovers for select to authenticated using (true);

-- turnovers: admin may create/edit/delete (manual turnovers, fixes).
drop policy if exists "admins write turnovers" on public.turnovers;
create policy "admins write turnovers"
  on public.turnovers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- bookings: admin-only read (reservation_url is admin click-through).
drop policy if exists "admins read bookings" on public.bookings;
create policy "admins read bookings"
  on public.bookings for select to authenticated using (public.is_admin());

-- sync_state: readable by any authenticated user so the "synced N ago" chip
-- works for everyone (it holds only timestamps).
drop policy if exists "sync_state readable by authenticated" on public.sync_state;
create policy "sync_state readable by authenticated"
  on public.sync_state for select to authenticated using (true);

-- sync_runs: admin-only (the health/monitoring surface, Section 5.13).
drop policy if exists "admins read sync_runs" on public.sync_runs;
create policy "admins read sync_runs"
  on public.sync_runs for select to authenticated using (public.is_admin());
