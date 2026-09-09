import { updateSkillBridgeAlertRuleAction } from "@/lib/actions/skillbridge";
import { requireAnyAppPermission } from "@/lib/auth/guard";
import { getSkillBridgeAlertRules } from "@/lib/skillbridge/rules";
import { ActionForm } from "../../../_components/action-form";
import { Field, PageHeader, PageShell, PrimaryButton, inputClassName } from "../../../_components/ui";
import { MilitarySubnav } from "../../_components/military-subnav";

const LABELS: Record<string, string> = {
  candidate_no_contact: "Candidate no contact",
  employer_feedback_overdue: "Employer feedback overdue",
  window_approaching: "Window approaching",
  no_opportunity: "No employer opportunity",
  resume_missing: "Resume missing",
  conversion_approaching: "Conversion approaching",
  window_starting_soon: "Window starting soon",
  window_ending_soon: "Window ending soon",
};

export default async function SkillBridgeAlertRulesPage() {
  const principal = await requireAnyAppPermission(["skillbridge.manage", "military.review"]);
  const rules = await getSkillBridgeAlertRules(principal.organizationId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Military talent"
        title="Pathway alert rules"
        description="Edit stored SkillBridge follow-up and window thresholds. This does not invent matching or MOS mapping rules."
      />
      <MilitarySubnav active="/app/military/skillbridge/alerts" />
      <div className="mt-6 space-y-4">
        {rules.rows.map((rule) => (
          <ActionForm key={rule.id} action={updateSkillBridgeAlertRuleAction} className="grid gap-3 border border-border bg-white p-4 sm:grid-cols-3">
            <input type="hidden" name="code" value={rule.code} />
            <Field label={LABELS[rule.code] ?? rule.code} name="thresholdDays">
              <input
                className={inputClassName}
                id={`threshold-${rule.code}`}
                name="thresholdDays"
                type="number"
                min={0}
                max={365}
                defaultValue={rule.thresholdDays}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked={rule.enabled} />
              Enabled
            </label>
            <div className="sm:col-span-3">
              <PrimaryButton>Save rule</PrimaryButton>
            </div>
          </ActionForm>
        ))}
      </div>
    </PageShell>
  );
}
