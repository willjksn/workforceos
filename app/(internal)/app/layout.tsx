import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { navGroupsForPrincipal } from "@/components/navigation/nav-config";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/notifications/service";
import { AuthorizationError, can } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

export default async function InternalAppLayout({
  children,
}: LayoutProps<"/app">) {
  let principal;
  try {
    principal = await getCurrentPrincipal();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <main className="mx-auto max-w-xl px-6 py-16">
          <h1 className="page-title">Access denied</h1>
          <p className="mt-4 text-muted-foreground">{error.message}</p>
        </main>
      );
    }
    throw error;
  }

  if (!principal) {
    redirect("/sign-in");
  }

  const groups = navGroupsForPrincipal(principal);
  const unreadNotifications = await unreadNotificationCount(principal.id, principal.organizationId);

  return (
    <AppShell groups={groups} unreadNotifications={unreadNotifications} scoutEnabled={can(principal, "scout.use")}>
      {children}
    </AppShell>
  );
}
