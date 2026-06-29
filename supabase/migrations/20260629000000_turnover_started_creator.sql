-- Two additive columns on turnovers:
--  * started_at — when the assigned cleaner taps "Start turnover". Drives the
--    progressive turnover page (booking/notes first; the closeout work appears
--    only once started). Null = claimed-but-not-started or unclaimed.
--  * created_by — who added a manual turnover, so the card can credit them
--    ("Manually added by …"). Null for Airbnb (synced) turnovers and any manual
--    ones created before this column existed.
alter table public.turnovers
  add column if not exists started_at timestamptz,
  add column if not exists created_by uuid references public.profiles (id);
