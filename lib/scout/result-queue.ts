export const SCOUT_QUEUE_EVENT = "workforceos:scout-queue";
export const SCOUT_QUEUE_STORAGE_KEY = "workforceos.scout.result-queue";

export type ScoutQueueItem = {
  href: string;
  title: string;
  type: string;
  id: string;
};

export type ScoutResultQueue = {
  prompt: string;
  items: ScoutQueueItem[];
};

export function cardsToQueueItems(
  cards: Array<{ href: string; title: string; type: string; id: string }>,
): ScoutQueueItem[] {
  const seen = new Set<string>();
  const items: ScoutQueueItem[] = [];
  for (const card of cards) {
    if (!card.href || seen.has(card.href)) continue;
    seen.add(card.href);
    items.push({
      href: card.href,
      title: card.title,
      type: card.type,
      id: card.id,
    });
  }
  return items;
}

export function normalizeScoutPath(path: string) {
  const [pathname] = path.split("?");
  if (!pathname) return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function indexInScoutQueue(items: ScoutQueueItem[], pathname: string) {
  const path = normalizeScoutPath(pathname);
  return items.findIndex((item) => normalizeScoutPath(item.href) === path);
}

export function scoutQueueNeighbor(items: ScoutQueueItem[], pathname: string, delta: -1 | 1) {
  const index = indexInScoutQueue(items, pathname);
  if (index < 0) return null;
  return items[index + delta] ?? null;
}

export function readScoutResultQueue(): ScoutResultQueue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SCOUT_QUEUE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScoutResultQueue;
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return { prompt: parsed.prompt ?? "", items: cardsToQueueItems(parsed.items) };
  } catch {
    return null;
  }
}

export function writeScoutResultQueue(queue: ScoutResultQueue) {
  if (typeof window === "undefined") return;
  const items = cardsToQueueItems(queue.items);
  if (!items.length) return;
  window.sessionStorage.setItem(
    SCOUT_QUEUE_STORAGE_KEY,
    JSON.stringify({ prompt: queue.prompt, items }),
  );
  window.dispatchEvent(new Event(SCOUT_QUEUE_EVENT));
}

export function clearScoutResultQueue() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SCOUT_QUEUE_STORAGE_KEY);
  window.dispatchEvent(new Event(SCOUT_QUEUE_EVENT));
}
