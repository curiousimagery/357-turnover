import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-display">Page not found</h1>
      <p className="text-body text-muted-foreground">
        That page doesn&apos;t exist or has moved.
      </p>
      <Button asChild size="touch">
        <Link href="/schedule">Back to the schedule</Link>
      </Button>
    </div>
  );
}
