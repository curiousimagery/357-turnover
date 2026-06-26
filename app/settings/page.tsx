import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings-form";
import { EmailSettings } from "@/components/email-settings";
import { type CategoryPrefMap } from "@/components/notification-preferences";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { DEFAULT_TAG_COLOR } from "@/lib/cleaner-tags";
import { NOTIFICATION_CATEGORIES } from "@/lib/notify/types";

/** All categories default to on (missing pref = both channels on). */
function defaultPrefs(): CategoryPrefMap {
  return Object.fromEntries(
    NOTIFICATION_CATEGORIES.map((c) => [c.key, { in_app: true, email: true }]),
  );
}

export default async function SettingsPage() {
  let canSave = false;
  let isAdmin = false;
  let currentEmail = "";
  let initialPrefs: CategoryPrefMap = defaultPrefs();
  let initial = {
    displayName: "",
    paymentPreference: "",
    color: DEFAULT_TAG_COLOR as string,
  };

  if (hasEnvVars) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      canSave = true;
      currentEmail = user.email ?? "";

      const { data: prefRows } = await supabase
        .from("notification_preferences")
        .select("type, in_app, email")
        .eq("user_id", user.id);
      const byType: Record<string, { in_app: boolean; email: boolean }> = {};
      for (const p of prefRows ?? []) {
        byType[p.type as string] = { in_app: p.in_app, email: p.email };
      }
      // A category channel is on unless a member type was explicitly turned off.
      initialPrefs = Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((c) => [
          c.key,
          {
            in_app: c.types.every((t) => byType[t]?.in_app !== false),
            email: c.types.every((t) => byType[t]?.email !== false),
          },
        ]),
      );

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, payment_preference, color, role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
      initial = {
        displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "",
        paymentPreference: profile?.payment_preference ?? "",
        color: profile?.color ?? DEFAULT_TAG_COLOR,
      };
    }
  }

  return (
    <div className="min-h-svh">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display">Account settings</h1>
          <p className="text-body text-muted-foreground">
            Your profile, tag, payments, and notifications — saved together.
          </p>
        </div>

        {!canSave && (
          <Card>
            <CardHeader>
              <CardTitle className="text-heading">Preview mode</CardTitle>
              <CardDescription className="text-caption">
                Sign in to save changes. You can still try the tag picker below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="touch" variant="outline">
                <Link href="/auth/login">Sign in</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <SettingsForm
              initial={initial}
              initialPrefs={initialPrefs}
              isAdmin={isAdmin}
              canSave={canSave}
            />
          </CardContent>
        </Card>

        {canSave && (
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-heading">Sign-in email</h2>
                <p className="text-caption text-muted-foreground">
                  Separate from the rest — changing it sends a confirmation link
                  to the new address.
                </p>
              </div>
              <EmailSettings currentEmail={currentEmail} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
