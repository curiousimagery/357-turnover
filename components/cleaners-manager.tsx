"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { CleanerTag } from "@/components/cleaner-tag";
import { inviteCleaner, setCleanerActive } from "@/app/cleaners/actions";

export type CleanerRow = {
  id: string;
  name: string;
  role: string;
  color: string | null;
  active: boolean;
};

/**
 * Admin cleaner management (Section 5.12). Invite pre-provisions an account and
 * emails a sign-in link; the activate toggle controls who appears in the assign
 * menu and can claim — we never hard-delete a person.
 */
export function CleanersManager({
  people,
  currentUserId,
}: {
  people: CleanerRow[];
  currentUserId: string;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pending, startTransition] = useTransition();

  function onInvite(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await inviteCleaner({ email, displayName });
      if (result.ok) {
        toast.success(`Invite sent to ${email.trim()}`);
        setEmail("");
        setDisplayName("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function onToggleActive(person: CleanerRow) {
    startTransition(async () => {
      const result = await setCleanerActive(person.id, !person.active);
      if (result.ok) {
        toast.success(
          person.active ? `${person.name} deactivated` : `${person.name} reactivated`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading">Invite a cleaner</h2>
          <p className="text-caption text-muted-foreground">
            Tip: you can use a Gmail alias like you+name@gmail.com to test.
          </p>
        </div>
        <form onSubmit={onInvite} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input
              id="invite-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Avery"
              className="h-14 text-body"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cleaner@example.com"
              className="h-14 text-body"
              required
            />
          </div>
          <div>
            <Button type="submit" size="touch" disabled={pending || !email}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-col gap-4">
        <h2 className="text-heading">People</h2>
        <Card className="flex flex-col">
          {people.map((person, i) => (
            <div key={person.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <CleanerTag name={person.name} color={person.color} withName />
                  <div className="flex items-center gap-2">
                    {person.role === "admin" && (
                      <StatusBadge tone="outline">Admin</StatusBadge>
                    )}
                    {!person.active && (
                      <StatusBadge tone="neutral">Inactive</StatusBadge>
                    )}
                  </div>
                </div>
                {person.id !== currentUserId && person.role !== "admin" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onToggleActive(person)}
                  >
                    {person.active ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
