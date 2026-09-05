import { notFound } from "next/navigation";

import {
  approveDeliverableAction,
  closeProjectAction,
  deliverDeliverableAction,
} from "@/lib/actions/delivery";
import { requireAppPermission } from "@/lib/auth/guard";
import { getProjectBundle } from "@/lib/delivery/engine";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  Card,
  DataTable,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  TabNav,
  formatDate,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { StatusBadge } from "@/components/ui/display";

const TABS = [
  "overview",
  "phases",
  "tasks",
  "deliverables",
  "meetings",
  "risks",
  "issues",
  "documents",
  "kpis",
  "billing",
  "activity",
] as const;

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const principal = await requireAppPermission("projects.read");
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = TABS.includes(tabParam as never) ? tabParam! : "overview";
  const bundle = await getProjectBundle(id, principal.organizationId);
  if (!bundle) notFound();
  const { project } = bundle;
  const overdue = bundle.tasks.filter((task) => task.dueDate && task.dueDate < new Date() && task.status !== "completed");

  return (
    <PageShell wide>
      <PageHeader
        eyebrow="Projects / Delivery"
        title={project.name}
        description="Consulting delivery, not a search project."
        metadata={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone={project.status === "at_risk" ? "warning" : "navy"}>{formatLabel(project.status)}</StatusBadge>
            <StatusBadge>{formatLabel(project.health)}</StatusBadge>
          </div>
        }
      />
      <TabNav
        items={TABS.map((item) => ({ id: item, label: formatLabel(item), href: `/app/projects/${project.id}?tab=${item}` }))}
        activeId={tab}
      />

      {tab === "overview" ? (
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="eyebrow">Client / service</p>
            <p className="mt-2 text-sm">{project.companyId ? "Linked client" : "—"}</p>
          </Card>
          <Card>
            <p className="eyebrow">Value</p>
            <p className="mt-2 font-serif text-2xl">{project.contractValue ?? "—"}</p>
          </Card>
          <Card>
            <p className="eyebrow">Next milestone</p>
            <p className="mt-2 text-sm">{project.nextMilestone ?? bundle.phases[0]?.name ?? "—"}</p>
          </Card>
          <Card>
            <p className="eyebrow">Overdue tasks</p>
            <p className="mt-2 font-serif text-2xl">{overdue.length}</p>
          </Card>
        </section>
      ) : null}

      {tab === "phases" ? (
        <DataTable columns={["Phase", "Sequence", "Status"]}>
          {bundle.phases.map((phase) => (
            <tr key={phase.id}>
              <td>{phase.name}</td>
              <td>{phase.sequence}</td>
              <td>{formatLabel(phase.status)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "tasks" ? (
        <DataTable columns={["Task", "Phase", "Status", "Due"]}>
          {bundle.tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.name}</td>
              <td>{task.phaseName}</td>
              <td>{formatLabel(task.status)}</td>
              <td>{formatDate(task.dueDate)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "deliverables" ? (
        <DataTable columns={["Deliverable", "Type", "Status", "Client-facing", ""]}>
          {bundle.deliverables.map((deliverable) => (
            <tr key={deliverable.id}>
              <td>{deliverable.name}</td>
              <td>{deliverable.deliverableType}</td>
              <td>{formatLabel(deliverable.status)}</td>
              <td>{deliverable.clientFacing ? "Yes" : "No"}</td>
              <td>
                <div className="flex gap-2">
                  {can(principal, "deliverables.approve") && !deliverable.approvedAt ? (
                    <ActionForm action={approveDeliverableAction}>
                      <input type="hidden" name="deliverableId" value={deliverable.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="text-sm underline" type="submit">
                        Approve
                      </button>
                    </ActionForm>
                  ) : null}
                  {can(principal, "deliverables.write") ? (
                    <ActionForm action={deliverDeliverableAction}>
                      <input type="hidden" name="deliverableId" value={deliverable.id} />
                      <input type="hidden" name="projectId" value={project.id} />
                      <button className="text-sm underline" type="submit">
                        Mark delivered
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "risks" ? (
        <DataTable columns={["Risk", "Severity", "Status"]}>
          {bundle.risks.map((risk) => (
            <tr key={risk.id}>
              <td>{risk.description}</td>
              <td>{risk.severity}</td>
              <td>{formatLabel(risk.status)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "issues" ? (
        <DataTable columns={["Issue", "Severity", "Status"]}>
          {bundle.issues.map((issue) => (
            <tr key={issue.id}>
              <td>{issue.description}</td>
              <td>{issue.severity}</td>
              <td>{formatLabel(issue.status)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "kpis" ? (
        <DataTable columns={["KPI", "Value", "Source"]}>
          {bundle.kpis.map((kpi) => (
            <tr key={kpi.id}>
              <td>{kpi.name}</td>
              <td>{kpi.value ?? "—"}</td>
              <td>{kpi.source ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "billing" ? (
        <DataTable columns={["Milestone", "Amount", "Status"]}>
          {bundle.billing.map((event) => (
            <tr key={event.id}>
              <td>{event.sourceMilestone}</td>
              <td>{event.amount}</td>
              <td>{formatLabel(event.status)}</td>
            </tr>
          ))}
        </DataTable>
      ) : null}

      {tab === "meetings" || tab === "documents" || tab === "activity" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {tab === "meetings" && bundle.meetings.length === 0
            ? "No meetings recorded."
            : "Operating records for this tab appear when they are stored in PostgreSQL."}
        </p>
      ) : null}

      {can(principal, "projects.write") && project.status !== "completed" ? (
        <ActionForm action={closeProjectAction} className="mt-10 max-w-xl space-y-3">
          <input type="hidden" name="projectId" value={project.id} />
          <Field label="Lessons learned" name="lessonsLearned">
            <textarea className={inputClassName} id="lessonsLearned" name="lessonsLearned" rows={3} />
          </Field>
          <Field label="Closeout override reason" name="overrideReason">
            <input className={inputClassName} id="overrideReason" name="overrideReason" />
          </Field>
          <PrimaryButton>Close project</PrimaryButton>
        </ActionForm>
      ) : null}
    </PageShell>
  );
}
