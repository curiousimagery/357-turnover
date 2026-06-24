"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmail } from "@/app/settings/actions";

/** View and change the email you sign in with. The change is confirmed via a
 *  link sent to the new address. */
export function EmailSettings({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateEmail(email);
      if (result.ok) {
        toast.success("Check your new inbox to confirm the change");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-14 text-body"
      />
      <p className="text-caption text-muted-foreground">
        This is how you sign in. Change it and we&apos;ll email the new address a
        confirmation link.
      </p>
      <div className="pt-2">
        <Button
          type="submit"
          size="touch"
          variant="outline"
          disabled={pending || email.trim().toLowerCase() === currentEmail}
        >
          {pending ? "Sending…" : "Update email"}
        </Button>
      </div>
    </form>
  );
}
