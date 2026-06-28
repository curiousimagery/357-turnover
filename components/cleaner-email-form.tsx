"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCleanerEmail } from "@/app/cleaners/actions";

/** Admin view + edit of a cleaner's sign-in email. */
export function CleanerEmailForm({
  cleanerId,
  initial,
}: {
  cleanerId: string;
  initial: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initial);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await updateCleanerEmail(cleanerId, email);
      if (result.ok) {
        toast.success("Email updated");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="cleaner-email">Sign-in email</Label>
      <Input
        id="cleaner-email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-14 text-body"
      />
      <p className="text-caption text-muted-foreground">
        How they sign in (magic link). Changing it takes effect immediately.
      </p>
      <div className="pt-1">
        <Button
          size="touch"
          variant="outline"
          disabled={pending || email.trim().toLowerCase() === initial.toLowerCase()}
          onClick={save}
        >
          {pending ? "Saving…" : "Update email"}
        </Button>
      </div>
    </div>
  );
}
