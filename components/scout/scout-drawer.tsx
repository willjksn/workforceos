"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Sparkles, X } from "lucide-react";

import { scoutConfirmAction, scoutPromptAction, scoutSendDraftAction, type ScoutClientResult } from "@/lib/actions/scout";
import { suggestedScoutPrompts } from "@/lib/scout/prompts";
import { parseScoutPageContext } from "@/lib/scout/page-context";
import { cardsToQueueItems, writeScoutResultQueue } from "@/lib/scout/result-queue";
import { useClientMounted } from "@/lib/client/use-client-mounted";
import { buttonClassName } from "@/components/ui/button";

export const OPEN_SCOUT_EVENT = "workforceos:open-scout";

export function requestOpenScout() {
  window.dispatchEvent(new Event(OPEN_SCOUT_EVENT));
}

export function OpenScoutButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={buttonClassName("secondary", className)}
      title="Open Scout"
      onClick={() => requestOpenScout()}
    >
      <Sparkles className="mr-2 h-4 w-4 text-navy fill-navy" strokeWidth={1.5} />
      Open Scout
    </button>
  );
}

type ScoutHistoryItem = { role: "user" | "scout"; text: string };

export function ScoutLauncher({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<ScoutHistoryItem[]>([]);
  const [result, setResult] = useState<ScoutClientResult | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_SCOUT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SCOUT_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-sm font-medium text-navy hover:bg-surface-muted"
        aria-label="Open Scout"
        title="Open Scout"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4 text-navy fill-navy" strokeWidth={1.5} />
        Scout
      </button>
      {open ? (
        <ScoutDrawer
          enabled={enabled}
          sessionId={sessionId}
          history={history}
          result={result}
          onSessionId={setSessionId}
          onHistory={setHistory}
          onResult={setResult}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

const PAGE_LABELS: Record<string, string> = {
  skillbridge: "Pathway operations",
  command_center: "Command Center",
  talent: "Talent",
  recruiting: "Recruiting",
  crm: "CRM",
  military: "Military Talent",
  workforce: "Workforce",
  projects: "Projects",
  finance: "Finance",
  reports: "Reports",
  app: "WorkforceOS",
};

function ScoutDrawer({
  enabled,
  sessionId,
  history,
  result,
  onSessionId,
  onHistory,
  onResult,
  onClose,
}: {
  enabled: boolean;
  sessionId: string | null;
  history: ScoutHistoryItem[];
  result: ScoutClientResult | null;
  onSessionId: (value: string | null) => void;
  onHistory: (value: ScoutHistoryItem[] | ((current: ScoutHistoryItem[]) => ScoutHistoryItem[])) => void;
  onResult: (value: ScoutClientResult | null) => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const page = parseScoutPageContext(pathname);
  const [prompt, setPrompt] = useState("");
  const [pending, startTransition] = useTransition();
  const mounted = useClientMounted();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prompts = suggestedScoutPrompts(page.module, page.entityType);
  const pageLabel = PAGE_LABELS[page.module] ?? page.module.replaceAll("_", " ");
  const cards = result?.cards?.filter((card, index, list) => list.findIndex((item) => item.href === card.href) === index) ?? [];

  function rememberQueue(nextCards: Array<{ href: string; title: string; type: string; id: string }>, nextPrompt: string) {
    const items = cardsToQueueItems(nextCards);
    if (items.length) writeScoutResultQueue({ prompt: nextPrompt, items });
  }

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mounted]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [history, result, pending]);

  function submit(text: string) {
    const value = text.trim();
    if (!value || !enabled) return;
    onHistory((current) => [...current, { role: "user", text: value }]);
    setPrompt("");
    startTransition(async () => {
      const next = await scoutPromptAction({ prompt: value, pathname, sessionId });
      onSessionId(next.sessionId ?? sessionId);
      onResult(next);
      onHistory((current) => [...current, { role: "scout", text: next.error ?? next.message ?? "No response." }]);
      if (next.cards?.length) rememberQueue(next.cards, value);
    });
  }

  function openRecord(href: string) {
    if (result?.cards?.length) {
      const lastPrompt = [...history].reverse().find((item) => item.role === "user")?.text ?? "";
      rememberQueue(result.cards, lastPrompt);
    }
    onClose();
    router.push(href);
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-stretch justify-end p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="scout-title">
      <button type="button" className="absolute inset-0 bg-navy/45" aria-label="Close Scout" onClick={onClose} />
      <aside
        className="relative z-[1] flex min-h-0 w-full max-w-[32rem] flex-col overflow-hidden rounded-[8px] border border-border bg-surface shadow-[var(--shadow-card)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-navy px-5 py-4 text-white">
          <div className="min-w-0">
            <p id="scout-title" className="font-serif text-2xl leading-none">
              Scout
            </p>
            <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/70">WorkforceOS Intelligence</p>
            <p className="mt-2 truncate text-xs text-white/80">This page · {pageLabel}</p>
          </div>
          <button type="button" className="rounded-[6px] p-1.5 hover:bg-white/10" aria-label="Close Scout" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-surface-muted px-4 py-4">
          {history.length === 0 ? (
            <div className="max-w-[92%] rounded-[8px] border border-border bg-surface px-3 py-2.5 text-sm text-navy shadow-[var(--shadow-sm)]">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal">Scout</p>
              <p className="mt-1.5">
                {enabled
                  ? "Ask about authorized records on this page. Scout uses stored WorkforceOS data and will not send messages or invent facts."
                  : "Scout is available after your WorkforceOS role includes scout.use. Ask an administrator to grant access."}
              </p>
            </div>
          ) : null}
          {history.map((item, index) => (
            <div key={`${item.role}-${index}`} className={item.role === "user" ? "flex justify-end" : ""}>
              <div
                className={`max-w-[92%] rounded-[8px] px-3 py-2.5 text-sm shadow-[var(--shadow-sm)] ${
                  item.role === "user" ? "bg-navy text-white" : "border border-border bg-surface text-navy"
                }`}
              >
                {item.role === "scout" ? (
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal">Scout</p>
                ) : null}
                <p className={item.role === "scout" ? "mt-1.5 whitespace-pre-wrap" : "whitespace-pre-wrap"}>{item.text}</p>
              </div>
            </div>
          ))}
          {pending ? (
            <div className="max-w-[92%] rounded-[8px] border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
              Scout is looking up stored records…
            </div>
          ) : null}
          {cards.length ? (
            <div className="space-y-2">
              {cards.map((card, index) => (
                <button
                  key={`${card.type}-${card.id}-${index}`}
                  type="button"
                  className="block w-full rounded-[8px] border border-card-border bg-card p-3 text-left hover:border-teal"
                  onClick={() => openRecord(card.href)}
                >
                  <p className="text-sm font-medium text-navy">{card.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.meta}</p>
                </button>
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
                      onResult(next);
                      onHistory((current) => [...current, { role: "scout", text: next.error ?? next.message ?? "Confirmed." }]);
                    })
                  }
                >
                  Confirm
                </button>
                <button
                  type="button"
                  className={buttonClassName("secondary")}
                  onClick={() => onResult(result ? { ...result, confirmation: null } : result)}
                >
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
                    onHistory((current) => [...current, { role: "scout", text: blocked.error ?? "Send blocked." }]);
                  })
                }
              >
                Send
              </button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-border bg-surface px-4 py-3">
          {prompts.length ? (
            <div className="mb-3 flex max-h-20 flex-wrap gap-2 overflow-y-auto">
              {prompts.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-[6px] border border-border bg-surface-muted px-2 py-1 text-[11px] text-navy hover:bg-surface disabled:opacity-50"
                  disabled={!enabled || pending}
                  onClick={() => submit(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="flex items-end gap-2 rounded-[8px] border border-border bg-surface-muted p-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(prompt);
            }}
          >
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(prompt);
                }
              }}
              rows={2}
              className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              placeholder="Message Scout"
              aria-label="Scout prompt"
              disabled={!enabled || pending}
            />
            <button
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-navy text-white hover:bg-primary-hover disabled:opacity-50"
              type="submit"
              disabled={!enabled || pending || !prompt.trim()}
              aria-label="Send to Scout"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
