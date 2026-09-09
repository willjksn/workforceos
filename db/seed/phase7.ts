import { eq } from "drizzle-orm";

import type { getDb } from "../index";
import {
  agentPermissions,
  agents,
  aiModelConfigs,
  automationRules,
  knowledgeRecords,
  promptVersions,
} from "../schema";
import { APPROVED_AGENTS, AUTOMATION_RULE_SPECS } from "../../lib/ai/registry";
import { INTERNAL_ORG_ID } from "./constants";

export async function seedPhase7Ai(
  db: ReturnType<typeof getDb>,
  options: { approvedByUserId?: string | null } = {},
) {
  const approvedByUserId = options.approvedByUserId ?? null;
  for (const definition of APPROVED_AGENTS) {
    await db
      .insert(agents)
      .values({
        organizationId: INTERNAL_ORG_ID,
        slug: definition.slug,
        name: definition.name,
        description: definition.description,
        status: "enabled",
        autonomyLevel: definition.autonomyLevel,
        defaultTaskType: definition.tasks[0],
        dailyCostLimitUsd: "25.0000",
        monthlyCostLimitUsd: "250.0000",
      })
      .onConflictDoUpdate({
        target: [agents.organizationId, agents.slug],
        set: {
          name: definition.name,
          description: definition.description,
          status: "enabled",
          autonomyLevel: definition.autonomyLevel,
          defaultTaskType: definition.tasks[0],
          dailyCostLimitUsd: "25.0000",
          monthlyCostLimitUsd: "250.0000",
        },
      });
  }

  const registered = await db.select().from(agents).where(eq(agents.organizationId, INTERNAL_ORG_ID));
  const bySlug = Object.fromEntries(registered.map((row) => [row.slug, row]));

  for (const definition of APPROVED_AGENTS) {
    const agent = bySlug[definition.slug];
    if (!agent) continue;
    for (const permissionSlug of definition.permissions) {
      await db
        .insert(agentPermissions)
        .values({ agentId: agent.id, permissionSlug })
        .onConflictDoNothing();
    }
    for (const task of definition.tasks) {
      await db
        .insert(promptVersions)
        .values({
          organizationId: INTERNAL_ORG_ID,
          agentId: agent.id,
          promptName: task,
          version: "1.0",
          status: "approved",
          content: `WorkforceOS ${definition.name} task ${task}. Use only supplied PostgreSQL context, approved workflows, and approved knowledge. Label sourced facts separately from inference. Never invent labor-market statistics, fees, or legal language. Never approve your own output. Never send external communications or execute contracts.`,
          changeReason: "Phase 7 initial approved prompt",
          approvedByUserId,
          approvedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(aiModelConfigs)
    .values({
      organizationId: INTERNAL_ORG_ID,
      taskType: "default",
      provider: "internal_heuristic",
      model: "heuristic-v1",
      modelVersion: "unconfigured",
      temperature: "0.200",
      timeoutMs: 30000,
      dailyCostLimitUsd: "50.0000",
      monthlyCostLimitUsd: "500.0000",
      fallbackProvider: "internal_heuristic",
      fallbackModel: "heuristic-v1",
      status: "active",
    })
    .onConflictDoNothing();

  for (const spec of AUTOMATION_RULE_SPECS) {
    await db
      .insert(automationRules)
      .values({
        organizationId: INTERNAL_ORG_ID,
        code: spec.code,
        name: spec.name,
        description: spec.name,
        eventName: spec.eventName,
        agentSlug: spec.agentSlug,
        taskKey: spec.taskKey,
        actionKey: spec.actionKey,
        status: "enabled",
      })
      .onConflictDoNothing();
  }

  const knowledgeSeed = [
    {
      slug: "professional-search-playbook",
      title: "Professional Search playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Professional Search (public site may say Professional & Technical Search — same offer) is one of five launch services. Commercial path: inquiry → CRM → discovery → approved solution → proposal → contract (Direct Hire or Retained Search Agreement on the engagement) → delivery project. Search execution: structured job → internal Talent Network before external sourcing → job-specific scores (never a universal score, never auto-reject) → human pipeline → human-approved client submission → interview → offer → placement (fee/guarantee from the agreement) → silver medalists. Recruiter Standard does not own opportunities. Scout uses closed commands only, never SQL, never PII in prompts, and cannot send. Canonical markdown: docs/business/playbooks/professional-search.md. Cite approved professional-search service_workflows — do not invent scoring or fee rules.",
      source: "docs/business/playbooks/professional-search.md",
      sourceUrl: "docs/business/playbooks/professional-search.md",
    },
    {
      slug: "military-talent-opportunity-assessment-playbook",
      title: "Military Talent Opportunity Assessment playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Military Talent Opportunity Assessment is a client assessment, not a SkillBridge program and not a sixth service. Capture civilian roles and constraints, translate using stored reviewed mappings only, map skills/gaps/bridge training with provenance, identify installations from stored occupation-installation links, draft recommendations, and require a human military reviewer. Originating agent cannot approve. Military Talent Partner does not own commercial opportunities. Pathway operations for transitioning people are a separate internal playbook. Canonical markdown: docs/business/playbooks/military-talent-opportunity-assessment.md. Do not invent MOS maps.",
      source: "docs/business/playbooks/military-talent-opportunity-assessment.md",
      sourceUrl: "docs/business/playbooks/military-talent-opportunity-assessment.md",
    },
    {
      slug: "ta-performance-assessment-playbook",
      title: "Talent Acquisition Performance Assessment playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Talent Acquisition Performance Assessment evaluates a client's TA operating performance. Collect operating data (missing values stay missing — never invent TTF, funnel, or agency spend), analyze funnel and sourcing mix, draft an improvement plan and 30/60/90 roadmap, require human review of client-facing findings, then optional implementation from an approved plan plus executed contract. External TA tools stay behind the Integration Hub. Canonical markdown: docs/business/playbooks/talent-acquisition-performance-assessment.md.",
      source: "docs/business/playbooks/talent-acquisition-performance-assessment.md",
      sourceUrl: "docs/business/playbooks/talent-acquisition-performance-assessment.md",
    },
    {
      slug: "fractional-talent-partner-playbook",
      title: "Fractional Talent Partner playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Fractional Talent Partner is scoped fractional talent leadership, not temp staffing or payroll. Covered and excluded work must be explicit. Never describe unlimited recruiting. Approve the engagement plan and linked legal package before delivery. Run recurring work on the delivery project and Jobs/Talent Network. Escalate capacity breaches. Monthly reviews are client-facing only after human deliverable approval. Canonical markdown: docs/business/playbooks/fractional-talent-partner.md.",
      source: "docs/business/playbooks/fractional-talent-partner.md",
      sourceUrl: "docs/business/playbooks/fractional-talent-partner.md",
    },
    {
      slug: "workforce-pipeline-assessment-playbook",
      title: "Workforce Pipeline Assessment playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Workforce Pipeline Assessment uses planning-level roles (not recruiting jobs). Collect baselines without fabricating headcount. Generate versioned 12/24/36-month forecasts with provenance. Model supply from stored sources including Talent Network aggregates (no unnecessary PII). Gaps warn when planned capacity is below the gap. Do not invent BLS, Census, or O*NET values. Human approval of the Workforce Pipeline Plan is required before client delivery. Approved roadmaps create project_tasks on the existing delivery project. Canonical markdown: docs/business/playbooks/workforce-pipeline-assessment.md.",
      source: "docs/business/playbooks/workforce-pipeline-assessment.md",
      sourceUrl: "docs/business/playbooks/workforce-pipeline-assessment.md",
    },
    {
      slug: "military-transition-pathway-playbook",
      title: "Military Transition / SkillBridge-eligible operations playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Military Transition / SkillBridge-eligible operations are internal pathway ops, not a sixth client offer and not a PierOne-owned SkillBridge program. Locked flow: Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity → Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other → Placement → Conversion. People are existing Talent Network candidates (skillbridge_profiles overlay). Do not duplicate a candidate per employer. Operator bundle: Military Talent Partner, not Specialist. Do not invent mapping rules. Canonical markdown: docs/business/playbooks/military-transition-pathway.md.",
      source: "docs/business/playbooks/military-transition-pathway.md",
      sourceUrl: "docs/business/playbooks/military-transition-pathway.md",
    },
    {
      slug: "recruiting-hiring-playbook",
      title: "Recruiting & Hiring playbook",
      knowledgeType: "recruiting_playbook" as const,
      content:
        "Recruiting & Hiring is shared search execution: Job → Candidate → Application → Screening → Matching → Client Submission → Interview → Offer → Hire → Onboarding. Internal Talent Network before external sourcing. Job-specific scores only. One candidate record. Human approval for submissions, material rejection, and offers. No /app/screening, /app/matching, or submission/interview/offer/placement detail routes — use the live lists and job pipeline. Onboarding /app/onboarding is candidate/new-hire, not PierOne employee Phase H. Scout cannot send. Canonical markdown: docs/business/playbooks/recruiting-and-hiring.md.",
      source: "docs/business/playbooks/recruiting-and-hiring.md",
      sourceUrl: "docs/business/playbooks/recruiting-and-hiring.md",
    },
    {
      slug: "client-discovery-playbook",
      title: "Client Discovery playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Client Discovery is the shared commercial intake: Website Inquiry → CRM → Qualification → Discovery → Solution. There is no /app/qualification route — qualify on the inquiry then the opportunity. Recruiter Standard does not own opportunities. Military Talent Partner does not own opportunities. Use approved discovery questions on the service_workflows record — do not invent a questionnaire. Title is not permission. Canonical markdown: docs/business/playbooks/client-discovery.md.",
      source: "docs/business/playbooks/client-discovery.md",
      sourceUrl: "docs/business/playbooks/client-discovery.md",
    },
    {
      slug: "proposal-contract-handoff-playbook",
      title: "Proposal / Contract Handoff playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Proposal / Contract Handoff: approved solution → draft proposal → internal_review → human proposals.approve → human send (Scout send denied) → legal package on the engagement → contracts.approve. /app/legal redirects to contracts. Legal templates are a list only. Live DocuSign is not wired. Pricing outside range needs pricing.approve. Delivery projects require an executed contract unless an audited Managing Partner override. Canonical markdown: docs/business/playbooks/proposal-contract-handoff.md.",
      source: "docs/business/playbooks/proposal-contract-handoff.md",
      sourceUrl: "docs/business/playbooks/proposal-contract-handoff.md",
    },
    {
      slug: "project-delivery-closeout-playbook",
      title: "Project Delivery / Closeout playbook",
      knowledgeType: "service_playbook" as const,
      content:
        "Project Delivery / Closeout uses /app/projects (consulting delivery), not a second project system. Client-facing deliverables need deliverables.approve. Reports read stored rows only. Invoices live at /app/finance/invoices with no invoice detail route. Amounts come from stored billing events. QuickBooks post is off until Phase I. There is no /app/expansion — use the company solutions tab and a new opportunity on one of the five catalog offers. Canonical markdown: docs/business/playbooks/project-delivery-closeout.md.",
      source: "docs/business/playbooks/project-delivery-closeout.md",
      sourceUrl: "docs/business/playbooks/project-delivery-closeout.md",
    },
    {
      slug: "military-mapping-methodology",
      title: "Military mapping methodology",
      knowledgeType: "military_methodology" as const,
      content:
        "Military-to-civilian mappings store source, version, confidence, origin, and review status. Do not invent mapping rules. Agent drafts start pending. The originating agent cannot approve them.",
      source: "DEC-MIL-001",
    },
    {
      slug: "military-talent-intermediary",
      title: "Military Talent intermediary model",
      knowledgeType: "military_methodology" as const,
      content:
        "PierOne is the workforce/talent intermediary connecting transitioning service members with employers and host companies. PierOne is generally not the SkillBridge host. SkillBridge is a pathway and opportunity type, not a PierOne-owned program and not a sixth launch service. Canonical flow: Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity Search / Development → Employer Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other Transition Pathway → Placement → Conversion. Transition Talent Profile is a military-transition overlay on an existing Talent Network candidate (physical table skillbridge_profiles). Do not duplicate a candidate per employer. A service member may join the Military Talent Network without a current opening. Employer Opportunity names the host/employer (physical table skillbridge_opportunities). Operator access bundle: Military Talent Partner. Do not use Military Talent Specialist in operator-facing copy. Do not invent military-mapping rules. In-app Academy article: /app/academy/military-talent.",
      source: "DEC-MIL-005",
    },
    {
      slug: "workforce-intelligence-method",
      title: "Workforce intelligence method",
      knowledgeType: "workforce_methodology" as const,
      content:
        "Forecasts, gaps, and scenarios are estimates with provenance. Do not fabricate BLS, Census, or O*NET values. Client-facing recommendations require human approval.",
      source: "DEC-WF-003",
    },
    {
      slug: "internal-process-ai-ops",
      title: "AI operations process",
      knowledgeType: "internal_process" as const,
      content:
        "Agents operate on PostgreSQL. Material outputs go to the Review Queue. Autonomy level 4 never sends unsupervised external commitments.",
      source: "DEC-AI-002",
    },
    {
      slug: "workforceos-academy",
      title: "WorkforceOS Academy",
      knowledgeType: "internal_process" as const,
      content:
        "WorkforceOS Academy is the in-app Help & Training surface at /app/academy. Nav label is Help & Training; Scout tooltip is Academy. Articles cite the PierOne operating manual and service playbooks. Required training is computed from effective permissions, not job title. Completing a module does not grant permissions. Scout may link /app/academy/[slug]. Scout cannot send externally. Restricted candidate PII is never placed in model context.",
      source: "docs/business/PIERONE_OPERATING_MANUAL.md",
    },
    {
      slug: "pierone-operating-manual",
      title: "PierOne Partners operating manual",
      knowledgeType: "internal_process" as const,
      content:
        "PierOne Partners is a Workforce & Talent Solutions firm. How we operate: SOLVE → BUILD → OPERATE. Five launch offers only: Professional Search (public site may say Professional & Technical Search — same offer, not a rename), Military Talent Opportunity Assessment, Talent Acquisition Performance Assessment, Fractional Talent Partner, Workforce Pipeline Assessment. Do not invent a sixth service. Repeatable screen maps: docs/business/SERVICE_PLAYBOOKS.md. Client flow: Website Inquiry → CRM → Qualification → Discovery → Solution → Proposal → Contract → Project → Delivery → Reporting → Invoice → Expansion. Recruiting flow: Job → Candidate → Application → Screening → Matching → Client Submission → Interview → Offer → Hire → Onboarding. Military flow (DEC-MIL-005): Transitioning Service Member → Military Talent Network → Transition Talent Profile → Skills Translation → Employer Opportunity → Match → Employer Engagement → Interview → SkillBridge / Direct Hire / Other → Placement → Conversion. Title is not permission (DEC-AUTH-002). Recruiter Standard does not own commercial opportunities (DEC-RBAC-001). Operator military bundle is Military Talent Partner, not Specialist. PierOne is the intermediary, not the SkillBridge host. Talent Network before external sourcing. Material AI needs human approval. Scout uses a closed command registry, never generates SQL, and cannot send externally yet. Canonical markdown: docs/business/PIERONE_OPERATING_MANUAL.md. In-app Academy (Help & Training) is /app/academy. Completing Academy training does not grant permissions.",
      source: "PIERONE_OPERATING_MANUAL.md",
    },
  ];
  for (const row of knowledgeSeed) {
    const sourceUrl = "sourceUrl" in row ? row.sourceUrl : undefined;
    await db
      .insert(knowledgeRecords)
      .values({
        organizationId: INTERNAL_ORG_ID,
        slug: row.slug,
        title: row.title,
        knowledgeType: row.knowledgeType,
        content: row.content,
        source: row.source,
        sourceUrl,
        status: "approved",
        version: "1.0",
        privacyClass: "internal",
        requiredPermission: "knowledge.read",
        approvedByUserId,
        approvedAt: new Date(),
        changeReason: "Phase G service playbook seed",
      })
      .onConflictDoUpdate({
        target: [knowledgeRecords.organizationId, knowledgeRecords.slug, knowledgeRecords.version],
        set: {
          title: row.title,
          knowledgeType: row.knowledgeType,
          content: row.content,
          source: row.source,
          sourceUrl,
          status: "approved",
          privacyClass: "internal",
          requiredPermission: "knowledge.read",
          changeReason: "Phase G service playbook seed",
          approvedByUserId,
          approvedAt: new Date(),
        },
      });
  }
}
