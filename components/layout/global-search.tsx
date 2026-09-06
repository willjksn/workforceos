"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { searchWorkforceOsAction, type GlobalSearchResult } from "@/lib/actions/search";
import type { GlobalSearchHit } from "@/lib/search/global";

const TYPE_LABEL: Record<GlobalSearchHit["type"], string> = {
  company: "Company",
  contact: "Contact",
  candidate: "Talent",
  job: "Job",
};

export function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const timer = window.setTimeout(() => runSearch(trimmed), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResult({ hits: [] });
      setOpen(true);
      return;
    }
    startTransition(async () => {
      const next = await searchWorkforceOsAction(trimmed);
      setResult(next);
      setOpen(true);
    });
  }

  function openHit(hit: GlobalSearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  return (
    <div ref={rootRef} className="relative hidden min-w-[220px] max-w-sm flex-1 md:block">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              runSearch(query);
            }
          }}
          placeholder="Search WorkforceOS"
          className="w-full rounded-[6px] border border-border bg-surface-muted py-1.5 pl-9 pr-3 text-sm placeholder:text-muted-foreground"
          aria-label="Search WorkforceOS"
          aria-expanded={open}
          aria-controls="workforceos-global-search-results"
          autoComplete="off"
        />
      </label>
      {open ? (
        <div
          id="workforceos-global-search-results"
          role="listbox"
          className="absolute right-0 z-30 mt-1 w-full min-w-[280px] overflow-hidden rounded-[8px] border border-border bg-surface shadow-[var(--shadow-card)]"
        >
          {pending ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching stored records…</p>
          ) : result?.error ? (
            <p className="px-3 py-2.5 text-sm text-danger">{result.error}</p>
          ) : !result || query.trim().length < 2 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Type at least two characters to search stored records.</p>
          ) : result.hits.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No matching companies, people, talent, or jobs.</p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {result.hits.map((hit) => (
                <li key={`${hit.type}-${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-surface-muted"
                    onClick={() => openHit(hit)}
                  >
                    <span className="text-sm font-medium text-navy">{hit.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABEL[hit.type]} · {hit.meta}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
