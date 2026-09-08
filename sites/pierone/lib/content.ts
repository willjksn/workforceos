export const SITE_NAME = "PierOne Partners";
export const SITE_TAGLINE =
  "We help organizations build the workforce they need today and prepare for the workforce they will need tomorrow.";
export const SITE_POSITIONING =
  "PierOne Partners helps organizations solve immediate talent needs while building stronger future workforce pipelines.";

export const BRAND_TAGLINE = "TALENT. WORKFORCE. OPPORTUNITY.";

export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/what-we-do", label: "Solutions", hasMenu: true },
  { href: "/military-talent", label: "Military Talent" },
  { href: "/careers", label: "Careers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/** @deprecated Use PRIMARY_NAV. Kept for older imports. */
export const NAV = PRIMARY_NAV;

export const SOLUTIONS_NAV = [
  { href: "/services/professional-technical-search", label: "Professional & Technical Search" },
  { href: "/services/military-talent-opportunity-assessment", label: "Military Talent Opportunity Assessment" },
  { href: "/services/talent-acquisition-performance-assessment", label: "Talent Acquisition Performance Assessment" },
  { href: "/services/fractional-talent-partner", label: "Fractional Talent Partner" },
  { href: "/services/workforce-pipeline-assessment", label: "Workforce Pipeline Assessment" },
  { href: "/workforce-development", label: "Workforce Development" },
] as const;

export const SERVICES = [
  {
    slug: "professional-technical-search",
    code: "professional-search" as const,
    name: "Professional & Technical Search",
    short: "Structured search for difficult professional and technical roles.",
    problem:
      "Critical professional and technical roles stay open when intake is vague, sourcing is fragmented, and hiring teams lack a disciplined search process.",
    whatWeDo:
      "PierOne runs retained or project search with a structured intake, an internal Talent Network search first, then targeted sourcing, screening, candidate presentation, interview support, and offer/placement coordination.",
    clientReceives:
      "A defined search process, qualified candidates presented against the agreed brief, and support through interviews and offer. This is not high-volume temporary staffing.",
    whoFor:
      "Employers hiring for professional, technical, and hard-to-fill roles where quality of fit matters more than speed alone.",
    engagement:
      "Typically opportunity discovery, search intake, confidential search execution, and placement support under a defined search agreement.",
  },
  {
    slug: "military-talent-opportunity-assessment",
    code: "military-talent-opportunity-assessment" as const,
    name: "Military Talent Opportunity Assessment",
    short: "Identify where military talent can strengthen a workforce.",
    problem:
      "Employers often know they want military talent but cannot see which roles, locations, and pipelines actually fit.",
    whatWeDo:
      "PierOne analyzes job families, translates military occupations and skills into civilian work, maps relevant installations and talent markets, and matches transitioning service members to employer opportunities — including SkillBridge-eligible host-company roles where they are relevant. PierOne is the intermediary, not automatically the SkillBridge host.",
    clientReceives:
      "An actionable military talent strategy grounded in occupation translation, geography, and employer matching. SkillBridge participation depends on a host employer, timing, and service/command approval. PierOne does not guarantee approvals, placements, or conversions.",
    whoFor:
      "Organizations exploring military hiring, SkillBridge-eligible host opportunities, or regional talent adjacent to installations.",
    engagement:
      "A scoped assessment: workforce/job-family review, translation, installation/talent-market mapping, and recommended next steps.",
  },
  {
    slug: "talent-acquisition-performance-assessment",
    code: "ta-performance-assessment" as const,
    name: "Talent Acquisition Performance Assessment",
    short: "Evaluate recruiting operations and recommend a future-state path.",
    problem:
      "Hiring slows when TA process, capacity, measurement, and ownership are unclear.",
    whatWeDo:
      "PierOne evaluates current talent acquisition processes, identifies bottlenecks, reviews recruiting performance, and recommends a future-state operating model with a practical roadmap.",
    clientReceives:
      "Findings, prioritized recommendations, and a roadmap. WorkforceOS may be used internally to operate the work; it is not sold as a public ATS marketplace.",
    whoFor:
      "Leaders who need an honest read of TA performance before adding headcount or tools.",
    engagement:
      "Discovery, process and performance review, recommendations, and a defined improvement roadmap.",
  },
  {
    slug: "fractional-talent-partner",
    code: "fractional-talent-partner" as const,
    name: "Fractional Talent Partner",
    short: "Embedded talent leadership with defined scope and cadence.",
    problem:
      "Growing organizations need recruiting leadership and operating rhythm without a full-time executive hire.",
    whatWeDo:
      "PierOne embeds talent leadership within a defined scope and capacity: recruiting operations, hiring support, reporting, and a regular operating cadence. Scope is never unlimited recruiting.",
    clientReceives:
      "Named capacity, agreed workstreams, and reporting. This is an engagement model, not temporary staffing or payroll.",
    whoFor:
      "Organizations that need senior talent support for a defined period or workload.",
    engagement:
      "A scoped fractional engagement with capacity, workstreams, and a meeting/reporting cadence.",
  },
  {
    slug: "workforce-pipeline-assessment",
    code: "workforce-pipeline-assessment" as const,
    name: "Workforce Pipeline Assessment",
    short: "Demand, supply, skills gaps, and pipeline strategy for critical roles.",
    problem:
      "Leaders feel future workforce risk but lack a structured view of demand, supply, military overlay, and pipeline options.",
    whatWeDo:
      "PierOne assesses demand and supply for critical roles, labor markets, military talent where relevant, skills gaps, and pipeline scenarios, then recommends a pipeline strategy.",
    clientReceives:
      "A structured workforce pipeline view and recommended actions. Forecasts are estimates with stated assumptions, not guarantees.",
    whoFor:
      "Employers and civic/industry partners planning critical-role pipelines over a multi-year horizon.",
    engagement:
      "Assessment of roles, demand/supply, gaps, and recommended pipeline actions, often followed by a delivery project if the client proceeds.",
  },
] as const;

export const PRIMARY_INDUSTRIES = [
  "Energy & Utilities",
  "Advanced Manufacturing",
  "Infrastructure",
  "Industrial & Technical Operations",
] as const;

export const SECONDARY_INDUSTRIES = [
  "Data Centers",
  "Aerospace & Defense",
  "Engineering",
  "Supply Chain & Logistics",
] as const;

export function serviceBySlug(slug: string) {
  return SERVICES.find((service) => service.slug === slug) ?? null;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}
