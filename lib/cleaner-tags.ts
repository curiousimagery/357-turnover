/**
 * Cleaner tag palette — a closed, user-chosen set (Section 5.15 / 6.2).
 * Each value maps to a `.tag-*` class defined in app/globals.css.
 * These are intentionally separate from the status tokens and never override
 * them. Keep this list in sync with the CSS classes.
 */
export const CLEANER_TAG_COLORS = [
  { value: "rose", label: "Rose", className: "tag-rose" },
  { value: "amber", label: "Amber", className: "tag-amber" },
  { value: "emerald", label: "Emerald", className: "tag-emerald" },
  { value: "sky", label: "Sky", className: "tag-sky" },
  { value: "violet", label: "Violet", className: "tag-violet" },
  { value: "teal", label: "Teal", className: "tag-teal" },
  { value: "slate", label: "Slate", className: "tag-slate" },
  { value: "fuchsia", label: "Fuchsia", className: "tag-fuchsia" },
] as const;

export type CleanerTagColor = (typeof CLEANER_TAG_COLORS)[number]["value"];

export const DEFAULT_TAG_COLOR: CleanerTagColor = "sky";

const CLASS_BY_VALUE: Record<string, string> = Object.fromEntries(
  CLEANER_TAG_COLORS.map((c) => [c.value, c.className]),
);

export function tagColorClass(value: string | null | undefined): string {
  if (value && value in CLASS_BY_VALUE) return CLASS_BY_VALUE[value];
  return CLASS_BY_VALUE[DEFAULT_TAG_COLOR];
}

export function isCleanerTagColor(value: unknown): value is CleanerTagColor {
  return (
    typeof value === "string" &&
    CLEANER_TAG_COLORS.some((c) => c.value === value)
  );
}
