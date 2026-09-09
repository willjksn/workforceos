export const REPORT_CATEGORIES = [
  "business",
  "sales",
  "recruiting",
  "talent",
  "military",
  "workforce",
  "projects",
  "finance",
  "ai",
] as const;

export const REPORT_QUESTIONS: Record<(typeof REPORT_CATEGORIES)[number], { title: string; summary: string }> = {
  business: {
    title: "What have we contracted, invoiced, and collected?",
    summary: "Stored invoice and contract amounts. QuickBooks remains the ledger.",
  },
  sales: {
    title: "Which opportunities are open, won, or lost?",
    summary: "Commercial pipeline from stored opportunity stages.",
  },
  recruiting: {
    title: "How are searches moving from intake to placement?",
    summary: "Funnel and cycle time from stored recruiting records.",
  },
  talent: {
    title: "Who is in the Talent Network and available?",
    summary: "Candidate operating counts. Contact details stay off unless a PII export is authorized.",
  },
  military: {
    title: "Where is military talent coverage and pathway activity?",
    summary: "Occupation coverage, Transition Talent Profiles, and employer/host opportunities.",
  },
  workforce: {
    title: "Which workforce gaps and assessments need action?",
    summary: "Planning estimates. Figures are never presented as certain.",
  },
  projects: {
    title: "Which delivery projects are at risk?",
    summary: "Delivery health from stored project, risk, and closeout records.",
  },
  finance: {
    title: "What is outstanding and recurring?",
    summary: "AR and recurring amounts from stored invoices. Not a general ledger.",
  },
  ai: {
    title: "What AI work is pending review or failing?",
    summary: "Run volume and estimated cost from the usage ledger.",
  },
};

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export type ReportFilters = {
  from?: Date;
  to?: Date;
  companyId?: string;
  serviceCode?: string;
  ownerUserId?: string;
};

export function parseReportFilters(searchParams: {
  from?: string;
  to?: string;
  companyId?: string;
  serviceCode?: string;
  ownerUserId?: string;
}): ReportFilters {
  const filters: ReportFilters = {};
  if (searchParams.from) {
    const from = new Date(searchParams.from);
    if (!Number.isNaN(from.getTime())) filters.from = from;
  }
  if (searchParams.to) {
    const to = new Date(searchParams.to);
    if (!Number.isNaN(to.getTime())) filters.to = to;
  }
  if (searchParams.companyId) filters.companyId = searchParams.companyId;
  if (searchParams.serviceCode) filters.serviceCode = searchParams.serviceCode;
  if (searchParams.ownerUserId) filters.ownerUserId = searchParams.ownerUserId;
  return filters;
}

export function inDateRange(value: Date | null | undefined, filters: ReportFilters) {
  if (!value) return !filters.from && !filters.to;
  if (filters.from && value < filters.from) return false;
  if (filters.to && value > filters.to) return false;
  return true;
}

export function isReportCategory(value: string): value is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(value);
}
