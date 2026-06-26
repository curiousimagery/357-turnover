"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { NOTIFICATION_CATEGORIES } from "@/lib/notify/types";

/** Per-category notification preference (in-app + email), keyed by category. */
export type CategoryPrefMap = Record<string, { in_app: boolean; email: boolean }>;

/**
 * Notification preferences as a small set of intent-based categories (not one
 * row per raw type). Controlled by the parent form so it saves with everything
 * else — one consistent save. Admin-only categories are hidden from cleaners.
 */
export function NotificationPreferences({
  value,
  onChange,
  isAdmin,
}: {
  value: CategoryPrefMap;
  onChange: (next: CategoryPrefMap) => void;
  isAdmin: boolean;
}) {
  const cats = NOTIFICATION_CATEGORIES.filter((c) => isAdmin || !c.adminOnly);

  function set(key: string, channel: "in_app" | "email", v: boolean) {
    const cur = value[key] ?? { in_app: true, email: true };
    onChange({ ...value, [key]: { ...cur, [channel]: v } });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex-1 text-caption font-semibold text-muted-foreground">
          Notify me about
        </span>
        <span className="w-16 text-center text-caption font-semibold text-muted-foreground">
          In-app
        </span>
        <span className="w-16 text-center text-caption font-semibold text-muted-foreground">
          Email
        </span>
      </div>
      {cats.map((c) => {
        const v = value[c.key] ?? { in_app: true, email: true };
        return (
          <div key={c.key} className="flex items-start gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <span className="text-body text-foreground">{c.label}</span>
              <span className="text-caption text-muted-foreground">{c.description}</span>
            </div>
            <span className="flex w-16 justify-center pt-1">
              <Checkbox
                checked={v.in_app}
                onCheckedChange={(x) => set(c.key, "in_app", x === true)}
                aria-label={`${c.label} — in-app`}
              />
            </span>
            <span className="flex w-16 justify-center pt-1">
              <Checkbox
                checked={v.email}
                onCheckedChange={(x) => set(c.key, "email", x === true)}
                aria-label={`${c.label} — email`}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}
