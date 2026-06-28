-- Simplify linen sets to just kind + label (Section 5.9 refinement). Within a
-- kind+label group the sets are interchangeable (e.g. four "White IKEA queen"
-- sheet sets mix freely) but stay distinct from another group ("Sand percale
-- Quince"). Color/brand were redundant — they fold into the label as a primer —
-- and the `notes` column was never used. Drop all three.
alter table public.linen_sets drop column if exists color;
alter table public.linen_sets drop column if exists brand;
alter table public.linen_sets drop column if exists notes;
