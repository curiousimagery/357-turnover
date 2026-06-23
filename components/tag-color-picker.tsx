"use client";

import { CLEANER_TAG_COLORS } from "@/lib/cleaner-tags";
import { cn } from "@/lib/utils";

/** Pick one color from the closed cleaner-tag palette (Section 5.15). */
export function TagColorPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Tag color"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {CLEANER_TAG_COLORS.map((color) => {
        const selected = value === color.value;
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            onClick={() => onChange(color.value)}
            className={cn(
              "h-14 w-14 rounded-md ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              color.className,
              selected && "ring-2 ring-ring ring-offset-2",
            )}
          />
        );
      })}
    </div>
  );
}
