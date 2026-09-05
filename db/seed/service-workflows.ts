export const LAUNCH_SERVICE_WORKFLOWS: Record<
  string,
  Array<{ name: string; instructions: string; requiresHumanApproval: boolean }>
> = {
  "professional-search": [
    {
      name: "Confirm client need and job record",
      instructions: "Confirm the client need and create or update the job record.",
      requiresHumanApproval: false,
    },
    {
      name: "Search internal Talent Network",
      instructions: "Search the internal Talent Network before any external sourcing.",
      requiresHumanApproval: false,
    },
    {
      name: "Score job-specific matches",
      instructions: "Score job-specific matches with explanations. Do not use a universal candidate score.",
      requiresHumanApproval: false,
    },
    {
      name: "Recruiter review",
      instructions: "Recruiter reviews and advances candidates on this job's pipeline.",
      requiresHumanApproval: false,
    },
    {
      name: "Submit, interview, offer, place",
      instructions: "Move qualified candidates through submission, interview, offer, and placement.",
      requiresHumanApproval: false,
    },
    {
      name: "Preserve silver medalists",
      instructions: "Keep silver medalists and prior applicants in talent pools for rediscovery.",
      requiresHumanApproval: false,
    },
  ],
  "military-talent-opportunity-assessment": [
    {
      name: "Capture civilian roles and constraints",
      instructions: "Capture client civilian roles, locations, and constraints.",
      requiresHumanApproval: false,
    },
    {
      name: "Translate to military occupations",
      instructions: "Translate civilian demand to military occupations.",
      requiresHumanApproval: false,
    },
    {
      name: "Map skills, gaps, and training",
      instructions: "Map skills, certifications, gaps, and bridge training.",
      requiresHumanApproval: false,
    },
    {
      name: "Identify likely installations",
      instructions: "Identify likely installations and bases.",
      requiresHumanApproval: false,
    },
    {
      name: "Draft recommendations with provenance",
      instructions: "Produce recommendations as drafts with provenance.",
      requiresHumanApproval: false,
    },
    {
      name: "Human approval of client-facing output",
      instructions: "Require human approval before client-facing output.",
      requiresHumanApproval: true,
    },
  ],
  "ta-performance-assessment": [
    {
      name: "Collect TA operating data",
      instructions: "Collect talent acquisition operating data and current process.",
      requiresHumanApproval: false,
    },
    {
      name: "Analyze funnel and sourcing mix",
      instructions: "Analyze funnel, sourcing mix, and internal talent reuse.",
      requiresHumanApproval: false,
    },
    {
      name: "Recommend operating changes",
      instructions: "Recommend operating changes as drafts.",
      requiresHumanApproval: false,
    },
    {
      name: "Human review of findings",
      instructions: "Human review of client-facing findings.",
      requiresHumanApproval: true,
    },
    {
      name: "Optional implementation project",
      instructions: "Create an implementation project from an approved plan when requested.",
      requiresHumanApproval: false,
    },
  ],
  "fractional-talent-partner": [
    {
      name: "Scope operating responsibilities",
      instructions: "Scope operating responsibilities and cadence. This is not temp staffing or payroll.",
      requiresHumanApproval: false,
    },
    {
      name: "Approve engagement plan",
      instructions: "Approve the engagement plan and linked legal package.",
      requiresHumanApproval: true,
    },
    {
      name: "Run recurring talent operations",
      instructions: "Run recurring talent operating work inside WorkforceOS.",
      requiresHumanApproval: false,
    },
    {
      name: "Review outcomes with the client",
      instructions: "Review outcomes with the client on a defined cadence.",
      requiresHumanApproval: false,
    },
  ],
  "workforce-pipeline-assessment": [
    {
      name: "Collect workforce and demand signals",
      instructions: "Collect current workforce and demand signals.",
      requiresHumanApproval: false,
    },
    {
      name: "Map occupations and skills",
      instructions: "Map occupations and skills.",
      requiresHumanApproval: false,
    },
    {
      name: "Forecast gaps",
      instructions: "Forecast supply and demand gaps.",
      requiresHumanApproval: false,
    },
    {
      name: "Recommend pipeline actions",
      instructions: "Recommend pipeline actions as drafts.",
      requiresHumanApproval: false,
    },
    {
      name: "Human approval of recommendations",
      instructions: "Human approval of client-facing recommendations.",
      requiresHumanApproval: true,
    },
  ],
};
