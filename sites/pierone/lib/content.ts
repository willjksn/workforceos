export const SITE_NAME = "Pier 24 Partners";
export const SITE_TAGLINE =
  "We help organizations build the workforce they need today and prepare for the workforce they will need tomorrow.";
export const SITE_POSITIONING =
  "Pier 24 Partners helps organizations solve immediate talent needs while building stronger future workforce pipelines.";

export const BRAND_TAGLINE = "TALENT. WORKFORCE. OPPORTUNITY.";

export const PRIMARY_NAV = [
  { href: "/", label: "Home" },
  { href: "/what-we-do", label: "Services", hasMenu: true },
  { href: "/military-talent", label: "Military Talent" },
  { href: "/industries", label: "Industries" },
  { href: "/careers", label: "Careers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

/** @deprecated Use PRIMARY_NAV. Kept for older imports. */
export const NAV = PRIMARY_NAV;

export const SERVICES = [
  {
    slug: "professional-technical-search",
    code: "professional-search" as const,
    featured: true,
    name: "Professional & Technical Search",
    short: "Structured search for difficult professional and technical roles.",
    problem:
      "Critical professional and technical roles stay open when intake is vague, sourcing is fragmented, and hiring teams lack a disciplined search process.",
    whatWeDo:
      "Pier 24 Partners runs retained or project search with a structured intake, an internal Talent Network search first, then targeted sourcing, screening, candidate presentation, interview support, and offer/placement coordination.",
    clientReceives:
      "A defined search process, qualified candidates presented against the agreed brief, and support through interviews and offer. This is not high-volume temporary staffing.",
    whoFor:
      "Employers hiring technical, professional, engineering, operations, supply chain, technology, and leadership roles where quality of fit matters more than volume.",
    engagement:
      "Typically opportunity discovery, search intake, confidential search execution, and placement support under a defined search agreement.",
  },
  {
    slug: "military-talent-opportunity-assessment",
    code: "military-talent-opportunity-assessment" as const,
    featured: true,
    name: "Military Talent Opportunity Assessment",
    short: "Employer-side analysis of where military talent may support the workforce.",
    problem:
      "Employers often know they want military talent but cannot see which roles, capabilities, channels, and barriers actually matter.",
    whatWeDo:
      "Pier 24 Partners looks at where military talent could support the workforce, which job families and capabilities are relevant, which military talent channels may align, what current and pipeline demand exists, and which barriers must be addressed. The firm is the intermediary. This assessment does not place SkillBridge interns and does not make Pier 24 Partners the SkillBridge host.",
    clientReceives:
      "An actionable military talent strategy grounded in occupation translation, geography, and employer matching. SkillBridge participation depends on a host employer, timing, and service/command approval. Pier 24 Partners does not guarantee approvals, placements, or conversions.",
    whoFor:
      "Organizations exploring military hiring, SkillBridge-eligible host opportunities, or regional talent adjacent to installations.",
    engagement:
      "A scoped assessment: workforce/job-family review, translation, installation/talent-market mapping, and recommended next steps.",
  },
  {
    slug: "talent-acquisition-performance-assessment",
    code: "ta-performance-assessment" as const,
    featured: false,
    name: "Talent Acquisition Performance Assessment",
    short: "Evaluate recruiting operations and recommend a future-state path.",
    problem:
      "Hiring slows when TA process, capacity, measurement, and ownership are unclear.",
    whatWeDo:
      "Pier 24 Partners reviews process, conversion, candidate experience, sourcing, response and accountability, workflow, technology, metrics, and the operating model, then recommends a practical path.",
    clientReceives:
      "Findings, prioritized recommendations, and a roadmap. WorkforceOS may support delivery when it is useful. It is not required for every assessment and it is not a public ATS.",
    whoFor:
      "Leaders who need an honest read of TA performance before adding headcount or tools.",
    engagement:
      "Discovery, process and performance review, recommendations, and a defined improvement roadmap.",
  },
  {
    slug: "fractional-talent-partner",
    code: "fractional-talent-partner" as const,
    featured: false,
    name: "Fractional Talent Partner",
    short: "Embedded talent leadership and capacity within a defined scope.",
    problem:
      "Growing organizations need talent leadership and operating rhythm without a full-time executive hire.",
    whatWeDo:
      "Pier 24 Partners embeds talent leadership for strategy, sourcing, recruiting execution, program management, military talent, process improvement, and workforce pipeline coordination. Scope and cadence are defined.",
    clientReceives:
      "Named capacity, agreed workstreams, and reporting. This is embedded talent leadership, not hourly staffing labor, temporary staffing, or payroll.",
    whoFor:
      "Organizations that need senior talent support for a defined period or workload.",
    engagement:
      "A scoped fractional engagement with capacity, workstreams, and a meeting/reporting cadence.",
  },
  {
    slug: "workforce-pipeline-assessment",
    code: "workforce-pipeline-assessment" as const,
    featured: true,
    name: "Workforce Pipeline Assessment",
    short: "Demand, supply, skills gaps, and pipeline strategy for critical roles.",
    problem:
      "Leaders feel future workforce risk but lack a structured view of demand, supply, military overlay, and pipeline options.",
    whatWeDo:
      "Pier 24 Partners looks at future demand, capability requirements, known supply, gaps, pipeline health, talent channels, and workforce risk, then recommends a strategy. The public offer does not expose the internal analysis method.",
    clientReceives:
      "A structured workforce pipeline view and recommended actions. Forecasts are estimates with stated assumptions, not guarantees.",
    whoFor:
      "Employers and civic/industry partners planning critical-role pipelines over a multi-year horizon.",
    engagement:
      "Assessment of roles, demand/supply, gaps, and recommended pipeline actions, often followed by a delivery project if the client proceeds.",
  },
] as const;

export const FEATURED_SERVICES = SERVICES.filter((service) => service.featured);

export const SOLUTIONS_NAV = FEATURED_SERVICES.map((service) => ({
  href: `/services/${service.slug}`,
  label: service.name,
}));

export const PRIMARY_INDUSTRIES = [
  "Energy & Utilities",
  "Advanced Manufacturing",
  "Infrastructure",
  "Industrial & Technical Operations",
  "Technology",
] as const;

export const SECONDARY_INDUSTRIES = [
  "Data Centers",
  "Aerospace & Defense",
  "Engineering",
  "Supply Chain & Logistics",
] as const;

export const INDUSTRY_SUMMARIES: Record<(typeof PRIMARY_INDUSTRIES)[number] | (typeof SECONDARY_INDUSTRIES)[number], string> = {
  "Energy & Utilities":
    "Employers in generation, transmission, distribution, and plant operations need technical people who can keep the system running. Pier 24 Partners can search for current openings and look ahead at roles that take years to develop.",
  "Advanced Manufacturing":
    "Production, maintenance, quality, and technical roles depend on fit with the process and the equipment. The work is targeted search and pipeline planning, not high-volume staffing.",
  Infrastructure:
    "Field, civil, and utility roles are tied to projects that have to keep moving. Pier 24 Partners can support the openings in front of an employer and the skilled roles that take longer to fill.",
  "Industrial & Technical Operations":
    "Maintenance, controls, and plant operations roles reward people who know the equipment. Military experience may be relevant when it shows what someone has operated, certified, and led, not only a military job title.",
  Technology:
    "Technical and professional roles where industrial systems, software, and operations technology meet. This is a workforce focus. Pier 24 Partners is not a technology company.",
  "Data Centers":
    "Facilities, critical-environment, and operations roles that keep a data center running. Fit depends on the employer's environment, certifications, and the work itself.",
  "Aerospace & Defense":
    "Engineering, maintenance, and technical operations roles in aerospace and defense. Military talent may align with some of this work. Pier 24 Partners is not a military-only firm, and no placement is guaranteed.",
  Engineering:
    "Professional and technical engineering roles where the discipline, the brief, and the work environment have to match. Search is built around that fit.",
  "Supply Chain & Logistics":
    "Planning, operations, and technical logistics roles that keep materials and product moving. The work can be an immediate search or a look at the roles an employer will need next.",
};

export function serviceBySlug(slug: string) {
  return SERVICES.find((service) => service.slug === slug) ?? null;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(/\/$/, "");
}
