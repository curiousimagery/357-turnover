import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { SettingsForm } from "@/components/settings-form";
import { EmailSettings } from "@/components/email-settings";
import {
  NotificationPreferences,
  type PrefMap,
} from "@/components/notification-preferences";
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

export default async function SettingsPage() {
  let canSave = false;
  let currentEmail = "";
  let notifPrefs: PrefMap = {};
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
      notifPrefs = Object.fromEntries(
        (prefRows ?? []).map((p) => [
          p.type,
          { in_app: p.in_app, email: p.email },
        ]),
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, payment_preference, color")
        .eq("id", user.id)
        .maybeSingle();
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
            Your account, your tag, and how you like to be paid.
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
            <SettingsForm initial={initial} canSave={canSave} />
          </CardContent>
        </Card>

        {canSave && (
          <Card>
            <CardContent className="pt-6">
              <EmailSettings currentEmail={currentEmail} />
            </CardContent>
          </Card>
        )}

        {canSave && (
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-heading">Notifications</h2>
                <p className="text-caption text-muted-foreground">
                  Choose how you hear about each kind of update.
                </p>
              </div>
              <NotificationPreferences initial={notifPrefs} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
