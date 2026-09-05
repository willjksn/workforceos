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
