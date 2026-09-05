import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthControls } from "@/app/auth-controls";
import { AuthorizationError } from "@/lib/rbac/permissions";
import { getCurrentPrincipal } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const productLinks = [
  { href: "/app/companies", label: "Companies" },
  { href: "/app/talent", label: "Talent" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/services", label: "Services" },
];

const adminLinks = [
  { href: "/app/admin/system-health", label: "System health" },
  { href: "/app/admin/agents", label: "Agents" },
  { href: "/app/admin/approvals", label: "Approvals" },
  { href: "/app/admin/integrations", label: "Integrations" },
  { href: "/app/admin/requirements", label: "Requirements" },
];

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
      <header className="border-b px-6 py-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <Link href="/app" className="font-semibold">
            WorkforceOS
          </Link>
          <AuthControls />
        </div>
        <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {productLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <span className="text-zinc-300">|</span>
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
