import { redirect } from "next/navigation";
import { and, count, eq } from "drizzle-orm";

import { AppShell } from "@/components/layout/app-shell";
import { navGroupsForPrincipal } from "@/components/navigation/nav-config";
import { getDb } from "@/db";
import { approvals } from "@/db/schema";
import { getCurrentPrincipal } from "@/lib/auth/session";
import { AuthorizationError } from "@/lib/rbac/permissions";

export const dynamic = "force-dynamic";

async function pendingApprovalCount(organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(approvals)
    .where(and(eq(approvals.organizationId, organizationId), eq(approvals.status, "pending")));
  return Number(row?.value ?? 0);
}

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
  const pendingApprovals = await pendingApprovalCount(principal.organizationId);

  return (
    <AppShell groups={groups} pendingApprovals={pendingApprovals}>
      {children}
    </AppShell>
  );
}
