# DATA_MODEL.md — schema & permissions

Distilled from spec Section 4, kept in sync with `supabase/migrations/`. Postgres
types. Enums are `text` with `check` constraints for migration friendliness. All
ids `uuid default gen_random_uuid()` unless noted; all tables have
`created_at timestamptz default now()`.

## Status

- **Implemented (Phase 0):** `profiles` + `is_admin()` + signup trigger
  (`handle_new_user`) + privileged-column guard (`enforce_profile_update_guard`)
  + RLS. Migration: `supabase/migrations/20260622000000_init_profiles.sql`.
- **Implemented (Phase 1):** `bookings`, `turnovers`, `sync_runs`, `sync_state`
  + RLS + explicit grants. Migration: `…20260623000000_schedule.sql`. The
  `service_role` writes (sync engine, bypasses RLS); `authenticated` reads
  `turnovers` + `sync_state`; `admin` reads `bookings` + `sync_runs`. A plain
  unique index on `turnovers(booking_out_id)` makes derivation idempotent (it's
  the sync upsert's ON CONFLICT target). Verified end-to-end against local
  Supabase (`lib/sync/reconcile.integration.test.ts`).
- **Pending (Phase 2+):** the remaining tables below, added by phase.

## Tables (target schema)

- **profiles** — one row per user, FK to `auth.users(id)`. `display_name` (not
  null), `role` (`admin`|`cleaner`, default `cleaner`), `payment_preference`
  (admin+self only), `color` (tag palette key), `active`. Initials derived in the
  app, not stored.
- **bookings** _(Phase 1)_ — raw reservations from the iCal feed (not blocks).
  `uid` unique, `check_in`, `check_out`, `status` (`active`|`cancelled`),
  `raw_summary` (expected `Reserved`), `reservation_url` (admin-only via RLS),
  `last_seen_at`. The guest phone last-4 is intentionally not stored. System
  writes only; cleaners use turnovers, not raw bookings.
- **turnovers** _(Phase 1)_ — the operational unit. `turnover_date`, `source`
  (`airbnb`|`manual`), `booking_out_id`, `booking_in_id`, `is_same_day`
  (recomputed every sync), `status`
  (`scheduled`|`claimed`|`completed`|`cancelled`), `completed_at`, `notes`. Sync
  only ever touches `airbnb` rows; never hard-deletes (marks cancelled).
- **turnover_assignments** _(Phase 2)_ — who is doing it. `turnover_id`,
  `cleaner_id`, `claimed_at`, `paid_at`, `amount` (admin+owner only),
  `bedding_taken`. **`unique (turnover_id)`** — the single most important
  constraint: it makes double-coverage impossible at the database level.
- **linen_sets** _(Phase 5)_ — individual sheet/duvet sets. `kind`, `color`,
  `brand`, `label`, `state`
  (`on_beds`|`with_cleaner`|`clean_backup`|`in_wash`), `held_by`, `notes`.
- **guest_feedback** _(Phase 4)_ — cleaner→admin about the guest. `cleanliness`
  (1–5), `note`, `damages`, `missing_items`.
- **cleaner_notes** _(Phase 4)_ — admin→cleaner durable feedback. `cleaner_id`
  (recipient), `author_id`, `body`, `acknowledged_at`.
- **supply_items** / **inventory_flags** _(Phase 5)_ — supply catalog and
  low-stock flags (no counts, just "running low").
- **maintenance_flags** _(Phase 5)_ — durable-goods / replacement flags.
- **requests** _(Phase 6)_ — coordination: `type`
  (`luggage_drop`|`early_checkin`|`other`), `message`, `target_time`, `status`
  (`pending`|`yes`|`no`|`conditional`), `response_note`, …
- **notifications** _(Phase 3)_ — channel-agnostic outbox. `recipient_id`,
  `channel` (`in_app`|`email`|`web_push`), `type`, `title`, `body`,
  `turnover_id`, `status` (`pending`|`sent`|`failed`|`read`), …
- **sync_runs** / **sync_state** _(Phase 1/3)_ — sync observability + heartbeat
  (`last_synced_at`, `last_success_at`).

See spec Section 4.1 for the exact DDL of pending tables.

## Permission matrix (RLS) — summary

`Y` = allowed, `own` = only own rows, blank = denied.

| Table                | Action                              | Admin | Cleaner            |
| -------------------- | ----------------------------------- | ----- | ------------------ |
| profiles             | read                                | Y     | Y (names + color)  |
| profiles             | update own (color, payment)         | Y     | own                |
| profiles             | create / deactivate / set role      | Y     |                    |
| bookings             | read / write                        | Y/sys |                    |
| turnovers            | read                                | Y     | Y                  |
| turnovers            | create / edit / delete              | Y     |                    |
| turnovers            | mark complete                       | Y     | own (if assigned)  |
| turnover_assignments | claim / unclaim                     | Y     | own                |
| turnover_assignments | reassign / set paid / amount        | Y     |                    |
| turnover_assignments | read amount / paid                  | Y     | own                |
| guest_feedback       | create / read                       | Y     | own (if assigned)  |
| cleaner_notes        | create / read all                   | Y     | read own / ack     |
| supply/inventory/... | create flags / read                 | Y     | own (if assigned)  |
| requests             | create / respond / read             | Y     | own turnovers      |
| notifications        | read / mark read                    | own   | own                |

### Phase 0 RLS notes (profiles)

- Any authenticated user can **read** profiles (names + colors power tags).
- A user can **update their own** row; the `enforce_profile_update_guard` trigger
  pins `role`/`active`/`id` for non-admins, so a cleaner cannot self-escalate
  even though RLS allows the update.
- **Admins** (`is_admin()`) can do anything to profiles. The first admin is set
  manually (e.g. `update profiles set role='admin' where id = '…'`), per Section
  5.1 — there is intentionally no public path to becoming admin.
- The signup trigger inserts the profile row (SECURITY DEFINER, bypasses RLS).
