import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { can } from "@/lib/rbac/permissions";

export default async function AppHomePage() {
  const principal = await requireCurrentPrincipal();
  const modules = [
    {
      href: "/app/companies",
      title: "Companies",
      body: "Client and prospect CRM: locations, contacts, signals, and opportunities.",
      show: can(principal, "companies.read"),
    },
    {
      href: "/app/talent",
      title: "Talent Network",
      body: "Permanent candidate records, pools, and rediscovery. Restricted PII.",
      show: can(principal, "candidates.read"),
    },
    {
      href: "/app/jobs",
      title: "Jobs & search",
      body: "Professional Search starts here. Internal Talent Network before any external sourcing.",
      show: can(principal, "jobs.read"),
    },
    {
      href: "/app/services",
      title: "Services",
      body: "Versioned launch-service workflows loaded from the database.",
      show: can(principal, "solutions.read") || can(principal, "jobs.read"),
    },
  ].filter((item) => item.show);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold">WorkforceOS</h1>
      <p className="mt-3 text-zinc-600">
        Internal operating system. PostgreSQL is the system of record. Agents do not own data.
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        Roles: {principal.roleSlugs.join(", ") || "none assigned"}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {modules.map((item) => (
          <Link key={item.href} href={item.href} className="rounded border p-4">
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{item.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
