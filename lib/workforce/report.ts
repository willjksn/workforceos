function escapeHtml(value?: string | number | null) {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type WorkforcePlanReport = {
  client: string;
  title: string;
  executiveSummary?: string | null;
  currentWorkforceState?: string | null;
  criticalOccupations?: string | null;
  demandForecast?: string | null;
  talentSupply?: string | null;
  workforceGaps?: string | null;
  militaryOpportunity?: string | null;
  educationTrainingOpportunity?: string | null;
  internalDevelopment?: string | null;
  recommendedPipelineMix?: string | null;
  scenarioAnalysis?: string | null;
  implementationRoadmap?: string | null;
  kpis?: string | null;
  risks?: string | null;
  assumptions?: string | null;
  provenance?: string | null;
};

export function renderWorkforcePlanHtml(input: WorkforcePlanReport) {
  const sections: Array<[string, string | null | undefined]> = [
    ["Executive Summary", input.executiveSummary],
    ["Current Workforce State", input.currentWorkforceState],
    ["Critical Occupations", input.criticalOccupations],
    ["Demand Forecast", input.demandForecast],
    ["Talent Supply", input.talentSupply],
    ["Workforce Gaps", input.workforceGaps],
    ["Military Opportunity", input.militaryOpportunity],
    ["Education / Training Opportunity", input.educationTrainingOpportunity],
    ["Internal Development", input.internalDevelopment],
    ["Recommended Pipeline Mix", input.recommendedPipelineMix],
    ["Scenario Analysis", input.scenarioAnalysis],
    ["Implementation Roadmap", input.implementationRoadmap],
    ["KPIs", input.kpis],
    ["Risks", input.risks],
    ["Assumptions", input.assumptions],
    ["Provenance", input.provenance],
  ];
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #0b1f33; margin: 48px; background: #f7f4ee; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #0b1f33; }
  .brand { color: #2f6f7e; letter-spacing: 0.14em; text-transform: uppercase; font-size: 11px; font-family: Arial, sans-serif; }
  h2 { font-size: 15px; margin-top: 28px; color: #2f6f7e; font-family: Arial, sans-serif; letter-spacing: 0.04em; text-transform: uppercase; }
  p { line-height: 1.55; }
  .notice { font-size: 13px; color: #5c6570; border-top: 1px solid #d9d3c7; padding-top: 16px; margin-top: 32px; }
</style></head>
<body>
  <p class="brand">PierOne Partners · Workforce Pipeline Plan</p>
  <h1>${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.client)} · ${escapeHtml(new Date().toLocaleDateString())}</p>
  ${sections
    .map(([heading, body]) => `<h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p>`)
    .join("\n")}
  <p class="notice">Forecasts, gaps, and scenarios are planning estimates with documented assumptions and confidence. They are not guaranteed outcomes. Client-facing recommendations require human approval.</p>
</body></html>`;
}
