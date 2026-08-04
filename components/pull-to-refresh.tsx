"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSyncNow } from "@/components/use-sync-now";

const THRESHOLD = 64; // px pulled (after resistance) to trigger a sync
const MAX_PULL = 96;
const RESISTANCE = 0.5;

/**
 * Pull-to-refresh for touch devices: dragging down from the top of the schedule
 * runs the same sync as tapping the synced badge. A no-op on desktop (no touch),
 * and it never swallows a normal scroll — it only engages when the page is
 * already at the top and the finger is moving down.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const { syncing, sync } = useSyncNow();
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    function set(v: number) {
      pullRef.current = v;
      setPull(v);
    }
    function onStart(e: TouchEvent) {
      startY.current = window.scrollY <= 0 && !syncing ? e.touches[0].clientY : null;
    }
    function onMove(e: TouchEvent) {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        set(0);
        return;
      }
      // Pulling down at the very top — take over so the browser doesn't scroll
      // or trigger its own overscroll refresh.
      e.preventDefault();
      set(Math.min(delta * RESISTANCE, MAX_PULL));
    }
    function onEnd() {
      if (startY.current !== null && pullRef.current >= THRESHOLD) sync();
      startY.current = null;
      set(0);
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [syncing, sync]);

  const offset = syncing ? THRESHOLD : pull;
  const opacity = syncing ? 1 : Math.min(1, pull / THRESHOLD);

  return (
    <>
      <div
        className="pointer-events-none fixed left-1/2 top-16 z-20 -translate-x-1/2"
        style={{ opacity, transform: `translateX(-50%) translateY(${offset - THRESHOLD}px)` }}
        aria-hidden={!syncing}
      >
        <div className="rounded-md border border-border bg-background p-2 shadow-sm">
          <RefreshCw
            className={cn("size-5 text-muted-foreground", syncing && "animate-spin")}
            style={syncing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
          />
        </div>
      </div>
      {children}
    </>
  );
}
