-- Phase 2: surface the Airbnb confirmation code on the turnover (Section 5.3).
-- It's the at-a-glance cross-reference back to the Airbnb reservation. Derived
-- during sync from the booking's reservation URL (.../details/<CODE>). Lives on
-- the turnover (readable by everyone) so it shows on every card; the admin-only
-- reservation_url stays on bookings. Low-sensitivity reference in a high-trust
-- setting — a code, not guest PII.
alter table public.turnovers
  add column if not exists confirmation_code text;
