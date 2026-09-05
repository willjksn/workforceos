import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthControls } from "@/app/auth-controls";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { getCurrentPrincipal } from "@/lib/auth/session";

import { AppNav, MobileAppNav } from "./_components/app-nav";
import { navGroupsForPrincipal } from "./_components/nav-config";

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
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-4 text-zinc-600">{error.message}</p>
        </main>
      );
    }
    throw error;
  }

  if (!principal) {
    redirect("/sign-in");
  }

  const groups = navGroupsForPrincipal(principal);

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 border-r px-3 py-6 md:block">
        <Link href="/app" className="block px-2 text-sm font-semibold">
          WorkforceOS
        </Link>
        <div className="mt-6">
          <AppNav groups={groups} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="border-b px-6 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <Link href="/app" className="font-semibold md:hidden">
              WorkforceOS
            </Link>
            <p className="hidden text-zinc-500 md:block">Internal operating system</p>
            <AuthControls />
          </div>
          <MobileAppNav groups={groups} />
        </header>
        {children}
      </div>
    </div>
  );
}
