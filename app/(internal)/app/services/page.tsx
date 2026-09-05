import Link from "next/link";

import { requireCurrentPrincipal } from "@/lib/auth/session";
import { listLaunchServices } from "@/lib/repositories/services";
import { AuthorizationError, can } from "@/lib/rbac/permissions";
import { PageHeader } from "../_components/ui";

export default async function ServicesPage() {
  const principal = await requireCurrentPrincipal();
  if (!can(principal, "solutions.read") && !can(principal, "jobs.read")) {
    throw new AuthorizationError("Missing permission: solutions.read");
  }
  const services = await listLaunchServices();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader
        title="Launch services"
        description="Workflows are version-controlled database records. Agents and operators follow the approved steps."
      />
      <ul className="mt-6 space-y-4">
        {services.map(({ service, workflows }) => (
          <li key={service.id} className="rounded border p-4">
            <Link className="font-semibold underline" href={`/app/services/${service.code}`}>
              {service.name}
            </Link>
            <p className="mt-2 text-sm text-zinc-600">{service.description}</p>
            <p className="mt-2 text-sm">{workflows.length} approved workflow steps</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
