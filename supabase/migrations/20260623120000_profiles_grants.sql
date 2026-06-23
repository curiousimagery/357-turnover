-- Phase 2 fix: explicit table grants for profiles. Phase 0 relied on default
-- privileges, which the hosted project provides but a fresh local database does
-- not — so locally service_role/authenticated couldn't read profiles (e.g. the
-- schedule's assignee embed). Make it explicit so local and hosted behave
-- identically (same reasoning as the Phase 1 schedule grants). RLS still governs
-- which rows each role sees; these only grant table access at all.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;
