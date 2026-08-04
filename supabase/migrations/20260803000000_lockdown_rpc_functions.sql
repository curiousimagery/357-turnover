-- Security hardening (Supabase advisor 0028/0029): keep internal SECURITY DEFINER
-- helpers off the public REST RPC surface (they were callable via /rest/v1/rpc by
-- anon/authenticated).
--
-- handle_new_user() and enforce_profile_update_guard() are TRIGGER functions. A
-- trigger runs its function regardless of the session role's EXECUTE grant (that
-- check happens only at CREATE TRIGGER time), so revoking the blanket grant is
-- safe — the triggers keep firing on auth.users insert / profiles update — and it
-- removes their RPC exposure entirely.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_profile_update_guard() from public, anon, authenticated;

-- NOTE: is_admin() is deliberately NOT locked down here. It is called inside RLS
-- policies, which the `authenticated` role must be able to execute — revoking that
-- would break row-level security across the app. The residual advisor warning is
-- inherent to using a SECURITY DEFINER helper in RLS and is low-risk: the function
-- only ever returns whether the *calling* user is an admin (no data, for anyone).
