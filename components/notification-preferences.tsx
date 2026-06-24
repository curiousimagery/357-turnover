"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { NOTIFICATION_TYPES, type NotificationChannel } from "@/lib/notify/types";
import { setNotificationPreference } from "@/app/settings/actions";

export type PrefMap = Record<string, { in_app: boolean; email: boolean }>;

/**
 * Per-type notification preferences: an In-app and an Email switch for each kind
 * of notification. Missing = both on (opt-out). Saves on toggle.
 */
export function NotificationPreferences({ initial }: { initial: PrefMap }) {
  const [prefs, setPrefs] = useState<PrefMap>(() => {
    const filled: PrefMap = {};
    for (const t of NOTIFICATION_TYPES) {
      filled[t.type] = initial[t.type] ?? { in_app: true, email: true };
    }
    return filled;
  });
  const [, startTransition] = useTransition();

  function toggle(type: string, channel: NotificationChannel, value: boolean) {
    setPrefs((p) => ({ ...p, [type]: { ...p[type], [channel]: value } }));
    startTransition(async () => {
      const result = await setNotificationPreference({ type, channel, value });
      if (!result.ok) {
        toast.error(result.error);
        setPrefs((p) => ({ ...p, [type]: { ...p[type], [channel]: !value } }));
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="flex-1 text-caption font-semibold text-muted-foreground">
          Notification
        </span>
        <span className="w-16 text-center text-caption font-semibold text-muted-foreground">
          In-app
        </span>
        <span className="w-16 text-center text-caption font-semibold text-muted-foreground">
          Email
        </span>
      </div>
      {NOTIFICATION_TYPES.map((t) => (
        <div key={t.type} className="flex items-center gap-4">
          <span className="flex-1 text-body text-foreground">{t.label}</span>
          <span className="flex w-16 justify-center">
            <Checkbox
              checked={prefs[t.type].in_app}
              onCheckedChange={(v) => toggle(t.type, "in_app", v === true)}
              aria-label={`${t.label} — in-app`}
            />
          </span>
          <span className="flex w-16 justify-center">
            <Checkbox
              checked={prefs[t.type].email}
              onCheckedChange={(v) => toggle(t.type, "email", v === true)}
              aria-label={`${t.label} — email`}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
