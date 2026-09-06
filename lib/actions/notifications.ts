"use server";

import { z } from "zod";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import {
  getNotificationForUser,
  listInAppNotifications,
  markNotificationRead,
} from "@/lib/notifications/service";

export type NotificationListItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  kind: string;
  read: boolean;
  createdAt: string;
};

export async function listMyNotificationsAction(): Promise<NotificationListItem[]> {
  const principal = await requireCurrentPrincipal();
  const rows = await listInAppNotifications(principal.id, principal.organizationId);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href,
    kind: row.kind,
    read: Boolean(row.readAt),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function openNotificationAction(id: string): Promise<{ href: string | null }> {
  const principal = await requireCurrentPrincipal();
  const parsed = z.string().uuid().parse(id);
  const row = await getNotificationForUser(parsed, principal.id);
  if (!row) return { href: null };
  await markNotificationRead(parsed, principal.id);
  return { href: row.href };
}
