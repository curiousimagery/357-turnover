"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

/**
 * Magic-link sign in (Section 5.1). No passwords. The link lands on
 * /auth/confirm, which verifies the OTP and creates the session.
 */
export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Accounts are provisioned by the admin in production; this stays
          // permissive for setup. The link returns to /auth/confirm.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-heading">Sign in</CardTitle>
          <CardDescription className="text-caption">
            We&apos;ll email you a magic link — no password to remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-2" role="status">
              <p className="text-body font-semibold text-foreground">
                Check your email
              </p>
              <p className="text-caption text-muted-foreground">
                We sent a sign-in link to {email}. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 text-body"
                  />
                </div>
                {error && <p className="text-caption text-danger">{error}</p>}
                <Button
                  type="submit"
                  size="touch"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending…" : "Email me a link"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
