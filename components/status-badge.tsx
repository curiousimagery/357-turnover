import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusBadge — drives off the status color tokens (Section 6.3).
 * Tones map to the four status tokens plus a neutral and an outline.
 */
const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-caption font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        urgent: "bg-urgent text-urgent-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        danger: "bg-danger text-danger-foreground",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({
  className,
  tone,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props} />
  );
}

export { statusBadgeVariants };
