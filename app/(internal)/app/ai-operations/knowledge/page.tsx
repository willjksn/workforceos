import { requireAppPermission } from "@/lib/auth/guard";
import { listKnowledge } from "@/lib/ai/engine";
import { approveKnowledgeAction, createKnowledgeAction } from "@/lib/actions/ai";
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

export default async function KnowledgePage() {
  const principal = await requireAppPermission("knowledge.read");
  const rows = await listKnowledge(principal.organizationId);
  const canWrite = can(principal, "knowledge.write");
  const canApprove = can(principal, "knowledge.approve");
  return (
    <PageShell wide>
      <PageHeader
        eyebrow="AI Operations"
        title="Knowledge Sources"
        description="Approved playbooks, methodologies, and lessons. Retrieval applies access control before content is returned. Restricted candidate PII is not stored here."
      />
      <AiSubnav active="/app/ai-operations/knowledge" />
      {canWrite ? (
        <CreatePanel title="Add knowledge record">
          <ActionForm action={createKnowledgeAction} className="grid gap-3 sm:grid-cols-2">
            <Field label="Slug">
              <input name="slug" className={inputClassName} required />
            </Field>
            <Field label="Title">
              <input name="title" className={inputClassName} required />
            </Field>
            <Field label="Type">
              <select name="knowledgeType" className={inputClassName} defaultValue="internal_process">
                <option value="service_playbook">Service playbook</option>
                <option value="military_methodology">Military methodology</option>
                <option value="workforce_methodology">Workforce methodology</option>
                <option value="legal_template_reference">Legal template reference</option>
                <option value="recruiting_playbook">Recruiting playbook</option>
                <option value="client_approved_insight">Client-approved insight</option>
                <option value="lessons_learned">Lessons learned</option>
                <option value="case_study">Case study</option>
                <option value="internal_process">Internal process</option>
              </select>
            </Field>
            <Field label="Source">
              <input name="source" className={inputClassName} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Content">
                <textarea name="content" className={inputClassName} rows={4} required />
              </Field>
            </div>
            <PrimaryButton>Save draft</PrimaryButton>
          </ActionForm>
        </CreatePanel>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No knowledge records." />
      ) : (
        <RecordList>
          {rows.map((row) => (
            <RecordRow
              key={row.id}
              title={`${row.title} · ${row.version}`}
              meta={`${formatLabel(row.knowledgeType)} · ${formatLabel(row.status)} · ${row.source ?? "no source"}`}
              trailing={
                canApprove && row.status !== "approved" ? (
                  <ActionForm action={approveKnowledgeAction}>
                    <input type="hidden" name="knowledgeRecordId" value={row.id} />
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
