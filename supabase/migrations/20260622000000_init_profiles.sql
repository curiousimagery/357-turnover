-- Phase 0: profiles, the signup trigger, and RLS.
-- Mirrors DATA_MODEL.md (Section 4). Migrations-first: this is the only way
-- the schema changes. Test on local Supabase before the hosted project.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, linked to auth.users. (Section 4.1)
-- Initials are derived from display_name in the app; never stored.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'cleaner' check (role in ('admin', 'cleaner')),
  payment_preference text, -- e.g. 'Venmo @handle'; visible to admin + self only
  color text, -- chosen tag color (a key from the cleaner-tag palette)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per user. Initials are derived from display_name in the app, not stored.';

-- ---------------------------------------------------------------------------
-- is_admin(): RLS helper. SECURITY DEFINER so it reads profiles without
-- recursing through RLS. The first admin is set manually (Section 5.1).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user(): create a profile row on signup. (Section 5.1)
-- display_name seeds from user metadata, else the email local-part.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Guard privileged columns. RLS can't restrict columns, so a BEFORE UPDATE
-- trigger keeps role/active/id unchanged for non-admins. This is what makes
-- the "update own profile" policy safe against role escalation.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.id := old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_update_guard on public.profiles;
create trigger enforce_profile_update_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_update_guard();

-- ---------------------------------------------------------------------------
-- RLS (Section 4.2)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Read: any authenticated user (cleaners need names + colors for tags).
-- Payment amounts live on assignments, not here (added in a later phase).
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Update own row (display_name, color, payment_preference). The guard trigger
-- prevents changing role/active.
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Admins manage all profiles: create, deactivate, set role.
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
