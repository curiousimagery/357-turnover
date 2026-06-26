"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NOTIFICATION_TYPES } from "@/lib/notify/types";
import {
  sendTestNotification,
  drainEmailsNow,
  simulateScenario,
  cleanupSpoofTurnovers,
} from "@/app/test/actions";

const selectClass =
  "h-14 rounded-md border border-input bg-background px-3 text-body";

type Scenario = "new" | "date_changed" | "cancelled" | "became_same_day";

const SCENARIOS: { value: Scenario; label: string; needsCleaner: boolean }[] = [
  { value: "new", label: "New turnover posted (tells all cleaners)", needsCleaner: false },
  { value: "date_changed", label: "Date moved on a claimed turnover", needsCleaner: true },
  { value: "cancelled", label: "Claimed turnover cancelled", needsCleaner: true },
  { value: "became_same_day", label: "Relaxed → same-day flip", needsCleaner: true },
];

export function TestTools({
  recipients,
  cleaners,
}: {
  recipients: { id: string; name: string }[];
  cleaners: { id: string; name: string }[];
}) {
  const [type, setType] = useState<string>(NOTIFICATION_TYPES[0].type);
  const [recipientId, setRecipientId] = useState(recipients[0]?.id ?? "");
  const [scenario, setScenario] = useState<Scenario>("new");
  const [scenarioCleanerId, setScenarioCleanerId] = useState(cleaners[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const needsCleaner = SCENARIOS.find((s) => s.value === scenario)?.needsCleaner ?? false;

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

  function runScenario() {
    startTransition(async () => {
      const result = await simulateScenario({
        scenario,
        cleanerId: needsCleaner ? scenarioCleanerId : undefined,
      });
      if (result.ok) toast.success(result.summary ?? "Scenario run.");
      else toast.error(result.error);
    });
  }

  function cleanup() {
    startTransition(async () => {
      const result = await cleanupSpoofTurnovers();
      if (result.ok) toast.success(result.summary ?? "Cleaned up.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Simulate a calendar change</h2>
          <p className="text-caption text-muted-foreground">
            Creates a clearly-labeled spoof turnover and fires the{" "}
            <strong>real</strong> notifications — real copy, real recipients, a
            working &ldquo;View turnover&rdquo; link, exactly as the hourly sync
            would. It notifies active cleaners, so prefer test accounts and clean
            up when you&rsquo;re done.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="scenario">Scenario</Label>
          <select
            id="scenario"
            className={selectClass}
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
          >
            {SCENARIOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {needsCleaner && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="scenario-cleaner">Cleaner on the turnover</Label>
            {cleaners.length > 0 ? (
              <select
                id="scenario-cleaner"
                className={selectClass}
                value={scenarioCleanerId}
                onChange={(e) => setScenarioCleanerId(e.target.value)}
              >
                {cleaners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-caption text-muted-foreground">
                Add an active cleaner first.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            size="touch"
            disabled={pending || (needsCleaner && !scenarioCleanerId)}
            onClick={runScenario}
          >
            Run scenario
          </Button>
          <Button size="touch" variant="outline" disabled={pending} onClick={cleanup}>
            Clean up spoof turnovers
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Send a test notification</h2>
          <p className="text-caption text-muted-foreground">
            Drops a single sample of any type into the chosen inbox (linked to the
            soonest turnover). Verify content, the deep link, archiving, and prefs.
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
