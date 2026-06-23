"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CleanerTag } from "@/components/cleaner-tag";
import { TagColorPicker } from "@/components/tag-color-picker";
import { getInitials } from "@/lib/utils";
import { DEFAULT_TAG_COLOR } from "@/lib/cleaner-tags";
import { saveProfile } from "@/app/settings/actions";

export function SettingsForm({
  initial,
  canSave,
}: {
  initial: { displayName: string; paymentPreference: string; color: string };
  canSave: boolean;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [paymentPreference, setPaymentPreference] = useState(
    initial.paymentPreference,
  );
  const [color, setColor] = useState(initial.color || DEFAULT_TAG_COLOR);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveProfile({
        displayName,
        paymentPreference,
        color,
      });
      if (result.ok) toast.success("Settings saved");
      else toast.error(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          className="h-14 text-body"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Breanna"
        />
        <p className="text-caption text-muted-foreground">
          Your initials ({getInitials(displayName || "Cleaner")}) are derived
          from this.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Tag color</Label>
        <p className="text-caption text-muted-foreground">
          Shown with your initials on turnovers you claim, so everyone can scan
          the schedule at a glance.
        </p>
        <TagColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-2 pt-2">
          <span className="text-caption text-muted-foreground">Preview</span>
          <CleanerTag name={displayName || "Cleaner"} color={color} withName />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="payment">Payment preference</Label>
        <Input
          id="payment"
          className="h-14 text-body"
          value={paymentPreference}
          onChange={(e) => setPaymentPreference(e.target.value)}
          placeholder="e.g. Venmo @handle"
        />
        <p className="text-caption text-muted-foreground">
          Visible only to you and the admin — never to other cleaners.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" size="touch" disabled={pending || !canSave}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {!canSave && (
          <span className="text-caption text-muted-foreground">
            Sign in to save.
          </span>
        )}
      </div>
    </form>
  );
}
