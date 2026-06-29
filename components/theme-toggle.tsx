"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

/** Light / Dark / Auto (match device). Persisted by next-themes. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Until mounted we don't know the resolved theme; default the highlight to Auto.
  const current = mounted ? theme ?? "system" : "system";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg bg-muted p-1"
    >
      {OPTIONS.map((o) => {
        const selected = current === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(o.value)}
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-md px-4 text-caption font-semibold transition-colors",
              selected
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
