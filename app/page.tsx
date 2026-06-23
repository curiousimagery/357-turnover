import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

/**
 * The schedule is the home screen. Signed-in users go straight there; everyone
 * else goes to sign-in. (No separate landing/placeholder page.)
 */
export default async function Home() {
  if (!hasEnvVars) redirect("/auth/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/schedule" : "/auth/login");
}
