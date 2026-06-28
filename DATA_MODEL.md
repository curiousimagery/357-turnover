# DATA_MODEL.md — schema & permissions

Distilled from spec Section 4, kept in sync with `supabase/migrations/`. Postgres
types. Enums are `text` with `check` constraints for migration friendliness. All
ids `uuid default gen_random_uuid()` unless noted; all tables have
`created_at timestamptz default now()`.

## Status

This documents **what the migrations actually create**, which diverges from the
spec's Section 4.1 sketch in a few places (noted inline). Source of truth is
`supabase/migrations/`.

- **Implemented (Phase 0):** `profiles` + `is_admin()` + signup trigger
  (`handle_new_user`) + privileged-column guard (`enforce_profile_update_guard`)
  + RLS. `…20260622000000_init_profiles.sql`.
- **Implemented (Phase 1):** `bookings`, `turnovers`, `sync_runs`, `sync_state`
  + RLS + explicit grants (`…20260623000000_schedule.sql`). A plain unique index
  on `turnovers(booking_out_id)` is the sync upsert's ON CONFLICT target.
  Verified end-to-end (`lib/sync/reconcile.integration.test.ts`).
- **Implemented (Phase 2):** `turnover_assignments` (`unique (turnover_id)` —
  the double-booking guard) + RLS (`…20260623100000_assignments.sql`).
  `confirmation_code` added to `turnovers` (`…110000`), derived during sync.
  Verified (`lib/schedule/assignments.integration.test.ts`: second claim → 23505).
- **Implemented (Phase 3):** `notifications` (idempotent outbox, `dedupe_key`
  unique) `…20260624000000`; `read_at` `…010000`; `archived_at` `…040000`;
  `notification_preferences` (per-user, per-type in_app/email) `…030000`.
- **Implemented (Phase 4):** `checklist_items` + `inventory_items` (admin-editable
  closeout cheat sheets) `…020000`; `guest_feedback` `…050000`. **Cleaner notes
  are not a table** — they're `notifications` rows with `type='cleaner_note'`.
- **Merged to `main` (Phases 5–6), pending hosted migration:** `payments` +
  `cleaner_rates` (`…060000`); `linen_sets` (`…070000`).
- **On `supplies-and-copy` branch, pending hosted migration:** `supply_notes`
  (running-low flags, spec 5.7–5.8) `…20260628000000`;
  `turnover_checklist_completions` (persisted closeout ticks) `…20260628010000`.
- **Not built (deferred to backlog):** `inventory_flags`/`maintenance_flags` as
  separate tables (folded into `supply_notes`), `requests`, and a dedicated
  `cleaner_notes` table. The spec still describes these; see `docs/BACKLOG.md`.

## Tables (as built)

- **profiles** _(P0)_ — one row per user, FK to `auth.users(id)`. `display_name`
  (not null), `role` (`admin`|`cleaner`), `payment_preference` (admin+self only),
  `color` (tag palette key), `active`. Initials derived in the app.
- **bookings** _(P1)_ — raw reservations from the feed (not blocks). `uid`
  unique, `check_in`, `check_out`, `status` (`active`|`cancelled`),
  `raw_summary`, `reservation_url` (admin-only), `last_seen_at`. Guest phone
  last-4 intentionally not stored. System writes only.
- **turnovers** _(P1)_ — the operational unit. `turnover_date`, `source`
  (`airbnb`|`manual`), `booking_out_id`, `booking_in_id`, `is_same_day`
  (recomputed every sync), `status`
  (`scheduled`|`claimed`|`completed`|`cancelled`), `completed_at`, `notes`
  (admin-set free text, currently used for manual turnovers), `confirmation_code`.
  Sync only touches `airbnb` rows; never hard-deletes.
- **turnover_assignments** _(P2)_ — who is doing it. `turnover_id`, `cleaner_id`,
  `claimed_at`. **`unique (turnover_id)`** makes double-coverage impossible at
  the DB level. _(Payment moved to its own `payments` table, not columns here.)_
- **notifications** _(P3)_ — channel-agnostic outbox. `recipient_id`, `channel`
  (`in_app`|`email`|`web_push`), `type`, `title`, `body`, `turnover_id`,
  `status` (`pending`|`sent`|`failed`|`read`), `dedupe_key` (unique → idempotent
  enqueue), `read_at`, `archived_at`, `sent_at`. Recipient reads/updates own;
  system writes.
- **notification_preferences** _(P3)_ — per-user, per-type channel toggles
  (`in_app`, `email`). Sender + badge respect these; the inbox always keeps all.
- **checklist_items** / **inventory_items** _(P4)_ — admin-editable cheat sheets
  (the "before you leave" checklist + inventory reference). Three display fields
  (`name`, `description`, `helper`) + `position` + `active`. **Note:** these are
  reference content, *not* the spec's per-turnover `supply_items`/`inventory_flags`
  low-stock workflow.
- **guest_feedback** _(P4)_ — cleaner→admin about the guest. `turnover_id`,
  `cleanliness` (1–5), `note`, `created_by`. **Note:** the spec's `damages` /
  `missing_items` columns were not built.
- **supply_notes** _(branch)_ — "running low" flags (spec 5.7–5.8). `turnover_id`
  (nullable — admin can file a standalone note), `author_id`, `body`, `resolved`
  + `resolved_at`/`resolved_by`. Admin reads all + resolves; the assigned cleaner
  files/reads on their own turnover. Maintenance flags (5.8) fold in as just
  another note. Surfaced per-turnover and on the admin `/supplies` board.
- **turnover_checklist_completions** _(branch)_ — persisted closeout ticks. PK
  `(turnover_id, item_id)` + `checked_by`/`checked_at`; unticking deletes the row.
  Admin + the assigned cleaner read/write their turnover's ticks.
- **payments** _(P6, phase-5-6)_ — one per turnover (`unique`). `cleaner_id`,
  `amount`, `paid_at`. Admin writes; admin + owning cleaner read (private amounts).
- **cleaner_rates** _(P6, phase-5-6)_ — `cleaner_id` (PK), `default_rate`. Its
  own table (not `profiles`, which is world-readable) so rates stay private.
- **linen_sets** _(P5, phase-5-6)_ — individual sheet/duvet sets, described by
  just `kind` (`sheet_set`|`duvet_set`) + `label` (not null) — the label is the
  interchangeable group (e.g. four "White IKEA queen" sets), with color/brand
  baked into it. `state` (`on_beds`|`with_cleaner`|`clean_backup`|`in_wash`),
  `held_by`. Everyone reads + moves state/holder; only admins add/remove.
  (`color`/`brand`/`notes` columns dropped — `…20260628020000`.)
- **sync_runs** / **sync_state** _(P1)_ — sync observability + heartbeat
  (`last_synced_at`, `last_success_at`), backing `/api/health`.

## Permission matrix (RLS) — summary

`Y` = allowed, `own` = only own rows, blank = denied.

| Table                         | Action                         | Admin | Cleaner           |
| ----------------------------- | ------------------------------ | ----- | ----------------- |
| profiles                      | read                           | Y     | Y (names + color) |
| profiles                      | update own (color, payment)    | Y     | own               |
| profiles                      | create / deactivate / set role | Y     |                   |
| bookings                      | read / write                   | Y/sys |                   |
| turnovers                     | read                           | Y     | Y                 |
| turnovers                     | create / edit / delete         | Y     |                   |
| turnovers                     | mark complete                  | Y     | own (if assigned) |
| turnover_assignments          | claim / unclaim                | Y     | own               |
| turnover_assignments          | reassign / unassign            | Y     |                   |
| guest_feedback                | create / read                  | Y     | own               |
| checklist_items / inventory   | read                           | Y     | Y                 |
| checklist_items / inventory   | create / edit / delete         | Y     |                   |
| checklist_completions         | read / tick                    | Y     | own (if assigned) |
| supply_notes                  | read / add                     | Y     | own (if assigned) |
| supply_notes                  | resolve / delete               | Y     |                   |
| payments                      | read                           | Y     | own               |
| payments                      | write (mark paid / amount)     | Y     |                   |
| cleaner_rates                 | read                           | Y     | own               |
| cleaner_rates                 | write                          | Y     |                   |
| linen_sets                    | read / move state              | Y     | Y                 |
| linen_sets                    | add / remove sets              | Y     |                   |
| notifications                 | read / mark read / archive     | own   | own               |
| notification_preferences      | read / update                  | own   | own               |

Cleaner notes (admin→cleaner) ride the `notifications` table (`type='cleaner_note'`),
so they obey the notifications policy: the recipient cleaner reads their own;
the admin authors via the service role. `supply_notes` and
`turnover_checklist_completions` writes likewise go through the service role after
the server action gates (admin or assigned cleaner); their RLS policies are the
backstop. Still-deferred tables (`requests`, a dedicated `cleaner_notes` table)
carry the spec's intended policies in Section 4.2 when built.

### Phase 0 RLS notes (profiles)

- Any authenticated user can **read** profiles (names + colors power tags).
- A user can **update their own** row; the `enforce_profile_update_guard` trigger
  pins `role`/`active`/`id` for non-admins, so a cleaner cannot self-escalate
  even though RLS allows the update.
- **Admins** (`is_admin()`) can do anything to profiles. The first admin is set
  manually (e.g. `update profiles set role='admin' where id = '…'`), per Section
  5.1 — there is intentionally no public path to becoming admin.
- The signup trigger inserts the profile row (SECURITY DEFINER, bypasses RLS).
