"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";

import {
  SCOUT_QUEUE_EVENT,
  clearScoutResultQueue,
  indexInScoutQueue,
  readScoutResultQueue,
  scoutQueueNeighbor,
} from "@/lib/scout/result-queue";
import { requestOpenScout } from "@/components/scout/scout-drawer";

function subscribeScoutQueue(onStoreChange: () => void) {
  window.addEventListener(SCOUT_QUEUE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(SCOUT_QUEUE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function ScoutResultPager() {
  const pathname = usePathname();
  const router = useRouter();
  const queue = useSyncExternalStore(subscribeScoutQueue, readScoutResultQueue, () => null);
  const index = queue ? indexInScoutQueue(queue.items, pathname) : -1;
  const previous = queue && index >= 0 ? scoutQueueNeighbor(queue.items, pathname, -1) : null;
  const next = queue && index >= 0 ? scoutQueueNeighbor(queue.items, pathname, 1) : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.getElementById("scout-title")) return;
      if (event.key === "ArrowLeft" && previous) {
        event.preventDefault();
        router.push(previous.href);
      }
      if (event.key === "ArrowRight" && next) {
        event.preventDefault();
        router.push(next.href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, router]);

  if (!queue || index < 0) return null;

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-surface/95 px-4 py-2 text-sm backdrop-blur sm:px-6">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal" strokeWidth={1.5} />
      <p className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-teal sm:block">Scout results</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-[6px] p-1.5 text-navy hover:bg-surface-muted disabled:opacity-30"
          aria-label="Previous Scout result"
          disabled={!previous}
          onClick={() => previous && router.push(previous.href)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-[3.5rem] text-center text-xs text-muted-foreground">
          {index + 1} of {queue.items.length}
        </p>
        <button
          type="button"
          className="rounded-[6px] p-1.5 text-navy hover:bg-surface-muted disabled:opacity-30"
          aria-label="Next Scout result"
          disabled={!next}
          onClick={() => next && router.push(next.href)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {queue.prompt ? (
        <p className="hidden max-w-xs truncate text-xs text-muted-foreground lg:block" title={queue.prompt}>
          {queue.prompt}
        </p>
      ) : null}
      <button
        type="button"
        className="rounded-[6px] px-2 py-1 text-xs font-medium text-navy hover:bg-surface-muted"
        title="Open Scout"
        onClick={() => requestOpenScout()}
      >
        Open Scout
      </button>
      <button
        type="button"
        className="rounded-[6px] p-1.5 text-navy hover:bg-surface-muted"
        aria-label="Dismiss Scout results"
        onClick={() => clearScoutResultQueue()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
