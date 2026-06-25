"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NOTIFICATION_TYPES } from "@/lib/notify/types";
import { sendTestNotification, drainEmailsNow } from "@/app/test/actions";

const selectClass =
  "h-14 rounded-md border border-input bg-background px-3 text-body";

export function TestTools({
  recipients,
}: {
  recipients: { id: string; name: string }[];
}) {
  const [type, setType] = useState<string>(NOTIFICATION_TYPES[0].type);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendTestNotification({ type, recipientId });
      if (result.ok) toast.success("Test notification sent to their inbox");
      else toast.error(result.error);
    });
  }

  function drain() {
    startTransition(async () => {
      const result = await drainEmailsNow();
      if (result.ok) {
        toast.success(`Emails — sent ${result.sent ?? 0}, failed ${result.failed ?? 0}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Send a test notification</h2>
          <p className="text-caption text-muted-foreground">
            Drops a sample into the chosen inbox (linked to the soonest turnover).
            Verify content, the deep link, archiving, and prefs.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="test-type">Type</Label>
          <select
            id="test-type"
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="test-recipient">Recipient</Label>
          <select
            id="test-recipient"
            className={selectClass}
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
          >
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Button size="touch" disabled={pending || !recipientId} onClick={send}>
            Send test notification
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Send pending emails now</h2>
          <p className="text-caption text-muted-foreground">
            Drains the email outbox immediately instead of waiting for the hourly
            sync. (Needs RESEND_API_KEY.)
          </p>
        </div>
        <div>
          <Button
            size="touch"
            variant="outline"
            disabled={pending}
            onClick={drain}
          >
            Send pending emails now
          </Button>
        </div>
      </Card>
    </div>
  );
}
