"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";

import { scoutConfirmAction, scoutPromptAction, scoutSendDraftAction, type ScoutClientResult } from "@/lib/actions/scout";
import { suggestedScoutPrompts } from "@/lib/scout/prompts";
import { parseScoutPageContext } from "@/lib/scout/page-context";
import { buttonClassName } from "@/components/ui/button";

export function ScoutLauncher({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (!enabled) return null;
  return (
    <>
      <button
        type="button"
        className="rounded-[6px] p-2 text-navy hover:bg-surface-muted"
        aria-label="Open Scout"
        title="Open Scout"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4" strokeWidth={1.5} />
      </button>
      {open ? <ScoutDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ScoutDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const page = parseScoutPageContext(pathname);
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ role: "user" | "scout"; text: string }>>([]);
  const [result, setResult] = useState<ScoutClientResult | null>(null);
  const [pending, startTransition] = useTransition();
  const prompts = suggestedScoutPrompts(page.module, page.entityType);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(text: string) {
    const value = text.trim();
    if (!value) return;
    setHistory((current) => [...current, { role: "user", text: value }]);
    setPrompt("");
    startTransition(async () => {
      const next = await scoutPromptAction({ prompt: value, pathname, sessionId });
      setSessionId(next.sessionId ?? sessionId);
      setResult(next);
      setHistory((current) => [...current, { role: "scout", text: next.error ?? next.message ?? "No response." }]);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="flex-1 bg-navy/30" aria-label="Close Scout" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-[var(--shadow-card)] sm:w-[420px]">
        <header className="flex items-start justify-between border-b border-border bg-navy px-5 py-4 text-white">
          <div>
            <p className="font-serif text-xl">Scout</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/70">WorkforceOS Intelligence</p>
          </div>
          <button type="button" className="rounded-[6px] p-1 hover:bg-white/10" aria-label="Close Scout" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ask about authorized records on this page. Scout uses stored PostgreSQL data and will not send messages or invent facts.
            </p>
          ) : null}
          {history.map((item, index) => (
            <div key={`${item.role}-${index}`} className={item.role === "user" ? "text-right" : ""}>
              <p className={`inline-block max-w-[95%] rounded-[8px] px-3 py-2 text-sm ${item.role === "user" ? "bg-navy text-white" : "border border-border bg-surface-muted text-navy"}`}>
                {item.text}
              </p>
            </div>
          ))}
          {result?.cards?.length ? (
            <div className="space-y-2">
              {result.cards.map((card) => (
                <Link key={`${card.type}-${card.id}`} href={card.href} className="block rounded-[8px] border border-card-border bg-card p-3 hover:border-teal">
                  <p className="text-sm font-medium text-navy">{card.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.meta}</p>
                </Link>
              ))}
            </div>
          ) : null}
          {result?.confirmation ? (
            <div className="rounded-[8px] border border-card-border bg-card p-4">
              <p className="text-sm font-medium text-navy">{result.confirmation.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{result.confirmation.body}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={buttonClassName("primary")}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const next = await scoutConfirmAction(result.confirmation!.actionId);
                      setResult(next);
                      setHistory((current) => [...current, { role: "scout", text: next.error ?? next.message ?? "Confirmed." }]);
                    })
                  }
                >
                  Confirm
                </button>
                <button type="button" className={buttonClassName("secondary")} onClick={() => setResult((current) => current ? { ...current, confirmation: null } : current)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {result?.draft ? (
            <div className="rounded-[8px] border border-card-border bg-card p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Draft for human review</p>
              <p className="mt-2 text-sm font-medium text-navy">{result.draft.subject}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{result.draft.body}</p>
              <button
                type="button"
                className={`${buttonClassName("secondary")} mt-3`}
                onClick={() =>
                  startTransition(async () => {
                    const blocked = await scoutSendDraftAction();
                    setHistory((current) => [...current, { role: "scout", text: blocked.error ?? "Send blocked." }]);
                  })
                }
              >
                Send
              </button>
            </div>
          ) : null}
        </div>
        <div className="border-t border-border px-4 py-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {prompts.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-[6px] border border-border px-2 py-1 text-[11px] text-navy hover:bg-surface-muted"
                onClick={() => submit(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(prompt);
            }}
          >
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-w-0 flex-1 rounded-[6px] border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Ask Scout"
              aria-label="Scout prompt"
            />
            <button className={buttonClassName("primary")} type="submit" disabled={pending}>
              Ask
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
