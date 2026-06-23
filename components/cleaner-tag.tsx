import { cn, getInitials } from "@/lib/utils";
import { tagColorClass } from "@/lib/cleaner-tags";

/**
 * CleanerTag — initials on a chosen color (Section 5.15 / 6.3).
 * The at-a-glance marker of whose turnover is whose.
 */
export function CleanerTag({
  name,
  color,
  withName = false,
  className,
}: {
  name: string;
  color?: string | null;
  withName?: boolean;
  className?: string;
}) {
  const initials = getInitials(name);
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-caption font-semibold",
          tagColorClass(color),
        )}
        aria-hidden="true"
      >
        {initials}
      </span>
      {withName ? (
        <span className="text-caption text-foreground">{name}</span>
      ) : (
        <span className="sr-only">{name}</span>
      )}
    </span>
  );
}
