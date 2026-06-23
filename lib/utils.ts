import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// True once the app is pointed at a Supabase project. Gates the auth proxy
// so the app (and the Style Guide) still render before Supabase is connected.
export const hasEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Initials from a display name, derived (never stored) per the data model.
 * "Breanna" -> "BR", "Tiffany Lopez" -> "TL".
 */
export function getInitials(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
