import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthorizationError } from "@/lib/rbac/permissions";
import { getCurrentPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InternalAppLayout({
  children,
}: LayoutProps<"/app">) {
  try {
    const principal = await getCurrentPrincipal();
    if (!principal) {
      redirect("/sign-in");
    }
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

  return (
    <div className="min-h-full">
      <header className="flex items-center justify-between border-b px-6 py-3 text-sm">
        <Link href="/app" className="font-semibold">
          WorkforceOS
        </Link>
        <nav className="flex gap-4">
          <Link href="/app/admin/system-health">System health</Link>
          <Link href="/app/admin/agents">Agents</Link>
          <Link href="/app/admin/approvals">Approvals</Link>
          <Link href="/app/admin/integrations">Integrations</Link>
          <Link href="/app/admin/requirements">Requirements</Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
