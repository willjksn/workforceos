import type { IntegrationHealth, IntegrationProviderId } from "./hub";

export type IntegrationCatalogEntry = {
  id: IntegrationProviderId;
  name: string;
  group: string;
  summary: string;
};

export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    id: "apollo",
    name: "Apollo",
    group: "Company and contact research",
    summary: "Discovers companies and buyer contacts. Records are stored in WorkforceOS, not in Apollo.",
  },
  {
    id: "onet",
    name: "O*NET",
    group: "Occupation reference",
    summary: "Civilian occupation and skill reference. Unconfigured sources stay labeled fixtures, never invented official values.",
  },
  {
    id: "bls",
    name: "Bureau of Labor Statistics",
    group: "Labor market",
    summary: "Employment and wage statistics. Unconfigured: adapter and labeled fixtures only. Never presented as live BLS data.",
  },
  {
    id: "census",
    name: "Census / LEHD / LODES",
    group: "Labor market",
    summary: "Geographic employment flows. Unconfigured: adapter and labeled fixtures only. Never presented as live Census data.",
  },
  {
    id: "linkedin-recruiter",
    name: "LinkedIn Recruiter",
    group: "Talent sourcing",
    summary: "External sourcing. Candidates remain one Talent CRM record in WorkforceOS.",
  },
  {
    id: "seekout",
    name: "SeekOut",
    group: "Talent sourcing",
    summary: "Preferred external sourcing adapter. Does not replace the internal Talent Network search. hireEZ remains a thin placeholder.",
  },
  {
    id: "hireez",
    name: "hireEZ",
    group: "Talent sourcing",
    summary: "External sourcing behind the Integration Hub.",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    group: "Workplace tools",
    summary: "Identity, mail, and documents. WorkforceOS remains the system of record.",
  },
  {
    id: "google",
    name: "Google Workspace",
    group: "Workplace tools",
    summary: "Identity, mail, and documents. WorkforceOS remains the system of record.",
  },
  {
    id: "docusign",
    name: "DocuSign",
    group: "Legal",
    summary: "Agreement execution. Legal packages still live on the engagement in WorkforceOS.",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    group: "Finance",
    summary: "Invoicing and AR support. No cap-table or ownership data.",
  },
  {
    id: "checkr",
    name: "Checkr",
    group: "Background checks",
    summary: "Preferred background provider. Live invitations when CHECKR_API_KEY is set; otherwise manual. Human review required; results never auto-reject.",
  },
  {
    id: "resend",
    name: "Resend",
    group: "Transactional email",
    summary: "System email for applications, interviews, offers, and onboarding. Not a recruiter mailbox.",
  },
  {
    id: "drug-screen",
    name: "Drug screen",
    group: "Pre-employment",
    summary: "Provider-neutral drug-screen adapter. No vendor is selected. ManualDrugScreenProvider only.",
  },
];

export function integrationStatusLabel(health: IntegrationHealth) {
  if (health.liveWired && health.wiring === "live") {
    return { label: "LIVE", tone: "success" as const };
  }
  if (health.configured) {
    return { label: "CONFIGURED", tone: "warning" as const };
  }
  if (!health.configured || health.connectionHealth === "not_configured") {
    return { label: "MOCK / MANUAL", tone: "neutral" as const };
  }
  if (health.connectionHealth === "error") {
    return { label: "Needs attention", tone: "danger" as const };
  }
  return { label: "Not checked", tone: "warning" as const };
}
