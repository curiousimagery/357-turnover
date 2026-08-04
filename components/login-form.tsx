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
          // Accounts are admin-provisioned (invite only). Never create a user
          // from the sign-in form — otherwise anyone typing any address makes us
          // send them an email, which is how a stranger's bounced signup can
          // disrupt sending. Only existing (admin-added) users get a link.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: unknown) {
      const raw = (err instanceof Error ? err.message?.trim() : "") ?? "";
      // shouldCreateUser:false rejects unknown emails ("Signups not allowed for
      // otp"). Never reveal whether an address has an account (enumeration) —
      // show the same neutral "check your email" screen as a real send. No email
      // is actually sent for an unknown address.
      const unknownUser = /signup|not allowed|otp_disabled/i.test(raw);
      if (unknownUser) {
        setSent(true);
      } else {
        console.error("sign-in error:", err);
        setError(
          raw && raw !== "{}"
            ? raw
            : "We couldn't send the sign-in link — the email service may be misconfigured (check Supabase SMTP). See the browser console for details.",
        );
      }
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
            Enter your email and we&apos;ll send a one-tap sign-in link — no
            password to remember.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-3" role="status">
              <p className="text-body font-semibold text-foreground">
                Check your email 📬
              </p>
              <p className="text-caption text-muted-foreground">
                If {email} has an account, a one-tap sign-in link is on its way —
                open it on this device and you&apos;re in. It works once and expires
                shortly. No link? Check spam, and confirm with your admin which
                email is on your account.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="inline-flex w-fit items-center text-caption font-semibold text-muted-foreground hover:text-foreground"
              >
                Use a different email
              </button>
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
