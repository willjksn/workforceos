import { requireAppPermission } from "@/lib/auth/guard";
import { listPromptVersions } from "@/lib/ai/engine";
import { listAgents } from "@/lib/ai/engine";
import { approvePromptAction, createPromptAction } from "@/lib/actions/ai";
import { can } from "@/lib/rbac/permissions";
import { ActionForm } from "../../_components/action-form";
import {
  CreatePanel,
  EmptyState,
  Field,
  PageHeader,
  PageShell,
  PrimaryButton,
  RecordList,
  RecordRow,
  formatLabel,
  inputClassName,
} from "../../_components/ui";
import { AiSubnav } from "../_components/ai-subnav";

export default async function PromptVersionsPage() {
  const principal = await requireAppPermission("agents.manage");
  const rows = await listPromptVersions(principal.organizationId);
  const agents = await listAgents(principal.organizationId);
  const canManage = can(principal, "agents.manage");
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Prompt Versions"
        description="Approved production prompts are immutable. Changes create a new version with a reason and approver."
      />
      <AiSubnav active="/app/ai-operations/prompts" />
      {canManage ? (
        <CreatePanel title="New prompt version">
          <ActionForm action={createPromptAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Agent">
              <select name="agentId" className={inputClassName}>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prompt name">
              <input name="promptName" className={inputClassName} required />
            </Field>
            <Field label="Version">
              <input name="version" className={inputClassName} defaultValue="1.1" required />
            </Field>
            <Field label="Change reason">
              <input name="changeReason" className={inputClassName} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Content">
                <textarea name="content" className={inputClassName} rows={4} required />
              </Field>
            </div>
            <PrimaryButton>Create draft version</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No prompt versions." />
      ) : (
        <RecordList>
          {rows.map(({ prompt, agent }) => (
            <RecordRow
              key={prompt.id}
              title={`${agent.name} / ${prompt.promptName} ${prompt.version}`}
              meta={formatLabel(prompt.status)}
              trailing={
                canManage && prompt.status === "draft" ? (
                  <ActionForm action={approvePromptAction}>
                    <input type="hidden" name="promptVersionId" value={prompt.id} />
                    <PrimaryButton>Approve</PrimaryButton>
                  </ActionForm>
                ) : null
              }
            />
          ))}
        </RecordList>
      )}
    </PageShell>
  );
}
