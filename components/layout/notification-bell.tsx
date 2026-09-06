"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import {
  listMyNotificationsAction,
  openNotificationAction,
  type NotificationListItem,
} from "@/lib/actions/notifications";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(unreadCount);
  const [items, setItems] = useState<NotificationListItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setUnread(unreadCount);
  }, [unreadCount]);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setItems(await listMyNotificationsAction());
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openItem(item: NotificationListItem) {
    startTransition(async () => {
      const next = await openNotificationAction(item.id);
      if (!item.read) setUnread((count) => Math.max(0, count - 1));
      setItems((current) =>
        current?.map((row) => (row.id === item.id ? { ...row, read: true } : row)) ?? current,
      );
      setOpen(false);
      if (next.href) router.push(next.href);
    });
  }

  return (
    <>
      <button
        type="button"
        className="relative rounded-[6px] p-2 text-navy hover:bg-surface-muted"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        title="Notifications"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-4 w-4" strokeWidth={1.5} />
        {unread > 0 ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning" /> : null}
      </button>
      {open && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[180]">
              <button type="button" className="absolute inset-0" aria-label="Close notifications" onClick={() => setOpen(false)} />
              <aside
                className="absolute right-4 top-14 flex max-h-[min(28rem,calc(100dvh-5rem))] w-[min(calc(100vw-2rem),22rem)] flex-col overflow-hidden rounded-[8px] border border-border bg-surface shadow-[var(--shadow-card)]"
                role="dialog"
                aria-label="Notifications"
              >
                <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-medium text-navy">Notifications</p>
                  {unread > 0 ? <p className="text-xs text-muted-foreground">{unread} unread</p> : null}
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {pending && !items ? (
                    <p className="px-4 py-8 text-sm text-muted-foreground">Loading notifications…</p>
                  ) : items && items.length > 0 ? (
                    <ul>
                      {items.map((item) => (
                        <li key={item.id} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            className="block w-full px-4 py-3 text-left hover:bg-surface-muted"
                            onClick={() => openItem(item)}
                          >
                            <p className={`text-sm ${item.read ? "text-navy" : "font-medium text-navy"}`}>{item.title}</p>
                            {item.body ? <p className="mt-1 text-xs text-muted-foreground">{item.body}</p> : null}
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {item.read ? "" : "Unread · "}
                              {new Date(item.createdAt).toLocaleString()}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-4 py-8 text-sm text-muted-foreground">
                      No notifications yet. SkillBridge follow-ups and windows appear here when a scan creates them.
                    </p>
                  )}
                </div>
                <footer className="flex shrink-0 gap-3 border-t border-border px-4 py-2 text-xs">
                  <Link href="/app/alerts" className="text-navy hover:underline" onClick={() => setOpen(false)}>
                    Operational alerts
                  </Link>
                  <Link href="/app/ai-operations/review" className="text-navy hover:underline" onClick={() => setOpen(false)}>
                    Review queue
                  </Link>
                </footer>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
