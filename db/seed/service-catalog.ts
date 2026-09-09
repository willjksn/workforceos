import type { workflowStepTypeEnum } from "../../db/schema/enums";

type StepType = (typeof workflowStepTypeEnum.enumValues)[number];

export type DiscoveryQuestion = {
  key: string;
  label: string;
  required: boolean;
  section?: string;
};

export type LaunchServiceCatalog = {
  id: string;
  code: string;
  name: string;
  practiceArea: string;
  pricingModel: "percentage_fee" | "fixed_project" | "monthly_recurring";
  minPrice: string;
  maxPrice: string;
  percentageFee?: string;
  minimumFee?: string;
  defaultDurationDays: number;
  definition: string;
  scopeDefinition: string;
  requiredInputs: string[];
  deliverables: string[];
  kpis: string[];
  clientResponsibilities: string;
  firmResponsibilities: string;
  legalRequirements: string;
  pricingGuidance: string;
  expansionServices: string[];
  workflow: {
    qualificationTriggers: string;
    dataCollection: string;
    aiResponsibilities: string;
    humanResponsibilities: string;
    approvalGates: string;
    deliverables: string;
    legalPackage: { required: string[]; conditional: string[] };
    projectTemplateCode: string;
    billingRules: string;
    kpis: string;
    completionRules: string;
    expansionRules: string;
    exceptionHandling: string;
    discoveryQuestions: DiscoveryQuestion[];
  };
  steps: Array<{
    name: string;
    instructions: string;
    requiresHumanApproval: boolean;
    stepType: StepType;
    responsibleRole: string;
    requiredInputs: string;
    outputType: string;
    blocking: boolean;
    completionCriteria: string;
    exceptionPath: string;
  }>;
  projectPhases: string[];
  projectDeliverables: Array<{
    name: string;
    deliverableType: string;
    required: boolean;
    clientFacing: boolean;
  }>;
};

function q(key: string, label: string, required = true, section?: string): DiscoveryQuestion {
  return { key, label, required, section };
}

export const SERVICE_IDS = {
  "professional-search": "00000000-0000-4000-8900-000000000001",
  "military-talent-opportunity-assessment": "00000000-0000-4000-8000-000000000701",
  "ta-performance-assessment": "00000000-0000-4000-8900-000000000003",
  "fractional-talent-partner": "00000000-0000-4000-8900-000000000004",
  "workforce-pipeline-assessment": "00000000-0000-4000-8900-000000000005",
} as const;

export function versionIdForService(serviceId: string) {
  if (serviceId === SERVICE_IDS["military-talent-opportunity-assessment"]) {
    return "00000000-0000-4000-8000-000000000702";
  }
  return serviceId.replace("8900", "8910");
}

export const LAUNCH_SERVICE_CATALOG: LaunchServiceCatalog[] = [
  {
    id: SERVICE_IDS["professional-search"],
    code: "professional-search",
    name: "Professional Search",
    practiceArea: "Recruiting",
    pricingModel: "percentage_fee",
    minPrice: "25000",
    maxPrice: "75000",
    percentageFee: "25",
    minimumFee: "25000",
    defaultDurationDays: 90,
    definition: "Internal-first retained or project search against the Talent Network, then approved external sources.",
    scopeDefinition:
      "Structured job intake, Internal Talent Network search, job-specific matching, pipeline, submission, interviews, offer, and placement. Not temp staffing or payroll.",
    requiredInputs: [
      "Role title",
      "Location",
      "Compensation range",
      "Required skills",
      "Hiring manager",
      "Search agreement fee and guarantee terms",
    ],
    deliverables: ["Search intake summary", "Search execution plan", "Candidate submissions", "Placement record"],
    kpis: ["Time to shortlist", "Time to interview", "Time to fill", "Submission-to-interview", "Offer acceptance", "Fee", "Guarantee"],
    clientResponsibilities: "Timely feedback, access to hiring managers, and decision-making on submissions and offers.",
    firmResponsibilities: "Internal-first search, explainable job-specific scoring, human-controlled pipeline and submissions.",
    legalRequirements: "Direct Hire or Retained Search Agreement. Conditional MSA, NDA, DPA, and vendor onboarding.",
    pricingGuidance: "Percentage-based fee with a documented minimum. Do not invent fee or guarantee terms.",
    expansionServices: [
      "fractional-talent-partner",
      "military-talent-opportunity-assessment",
      "workforce-pipeline-assessment",
    ],
    workflow: {
      qualificationTriggers: "Open professional search need with a defined role and client decision-maker.",
      dataCollection: "Structured job record, compensation, skills, and search-agreement terms.",
      aiResponsibilities: "Draft intake summary and search plan from discovery and the approved workflow. Do not invent contract terms.",
      humanResponsibilities: "Recruiter screening, submissions, and placement terms from the search agreement.",
      approvalGates: "Human approval for client submissions, proposals, pricing outside range, and contracts.",
      deliverables: "Search intake summary, execution plan, and placement documentation.",
      legalPackage: {
        required: ["direct_hire_search_agreement"],
        conditional: ["msa", "nda", "dpa", "retained_search_agreement"],
      },
      projectTemplateCode: "professional-search-delivery",
      billingRules: "Placement or start triggers a placement-fee billing event from the search agreement.",
      kpis: "Time to shortlist, interview, fill; conversion rates; fee; guarantee.",
      completionRules: "Required deliverables complete, placement or documented close, billing trigger created.",
      expansionRules: "Fractional TA, Military Assessment, Workforce Pipeline.",
      exceptionHandling: "If internal search cannot fill, external sourcing stays blocked until internal search is marked complete.",
      discoveryQuestions: [
        q("roleTitle", "Role title"),
        q("reportingLine", "Reporting line"),
        q("location", "Location"),
        q("compensation", "Compensation"),
        q("requiredSkills", "Required skills"),
        q("preferredSkills", "Preferred skills", false),
        q("experience", "Experience"),
        q("education", "Education", false),
        q("certifications", "Certifications", false),
        q("team", "Team"),
        q("reasonOpen", "Reason the role is open"),
        q("urgency", "Urgency"),
        q("targetStart", "Target start"),
        q("travel", "Travel", false),
        q("relocation", "Relocation", false),
        q("interviewProcess", "Interview process"),
        q("successMeasures", "Success measures"),
        q("whyCandidates", "Why candidates should want the role"),
        q("previousSearchFailed", "Why previous search failed", false),
        q("hiringManagerExpectations", "Hiring manager expectations"),
      ],
    },
    steps: [
      {
        name: "Confirm client need and job record",
        instructions: "Confirm the client need and create or update the structured job record.",
        requiresHumanApproval: false,
        stepType: "discovery",
        responsibleRole: "recruiter",
        requiredInputs: "Role, location, compensation, skills",
        outputType: "job_record",
        blocking: true,
        completionCriteria: "Job record exists with intake fields.",
        exceptionPath: "Return to client if the role is not defined.",
      },
      {
        name: "Search internal Talent Network",
        instructions: "Search the internal Talent Network before any external sourcing.",
        requiresHumanApproval: false,
        stepType: "data_collection",
        responsibleRole: "recruiter",
        requiredInputs: "Activated job",
        outputType: "search_project",
        blocking: true,
        completionCriteria: "Internal search started and later marked complete.",
        exceptionPath: "Do not open external sourcing.",
      },
      {
        name: "Score job-specific matches",
        instructions: "Score job-specific matches with explanations. Do not use a universal candidate score.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "recruiter",
        requiredInputs: "Matches",
        outputType: "component_scores",
        blocking: true,
        completionCriteria: "Component scores stored with strengths and gaps.",
        exceptionPath: "Scores never auto-reject.",
      },
      {
        name: "Recruiter review",
        instructions: "Recruiter reviews and advances candidates on this job's pipeline.",
        requiresHumanApproval: false,
        stepType: "human_review",
        responsibleRole: "recruiter",
        requiredInputs: "Pipeline",
        outputType: "pipeline_movement",
        blocking: true,
        completionCriteria: "Human-controlled pipeline movement is audited.",
        exceptionPath: "Material rejection is a human decision.",
      },
      {
        name: "Submit, interview, offer, place",
        instructions: "Move qualified candidates through submission, interview, offer, and placement.",
        requiresHumanApproval: true,
        stepType: "deliverable",
        responsibleRole: "recruiter",
        requiredInputs: "Qualified matches",
        outputType: "placement",
        blocking: true,
        completionCriteria: "Human-approved submission; placement copies fee and guarantee from the agreement.",
        exceptionPath: "Do not send unapproved submissions.",
      },
      {
        name: "Preserve silver medalists",
        instructions: "Keep silver medalists and prior applicants in talent pools for rediscovery.",
        requiresHumanApproval: false,
        stepType: "closeout",
        responsibleRole: "talent-partner",
        requiredInputs: "Finalists not placed",
        outputType: "talent_pool_membership",
        blocking: false,
        completionCriteria: "Silver medalists remain rediscoverable.",
        exceptionPath: "Privacy deletion is a separate process.",
      },
    ],
    projectPhases: [
      "Intake",
      "Search Strategy",
      "Sourcing",
      "Candidate Assessment",
      "Client Submission",
      "Interviews",
      "Offer",
      "Placement",
      "Guarantee",
    ],
    projectDeliverables: [
      { name: "Search Intake Summary", deliverableType: "intake", required: true, clientFacing: true },
      { name: "Search Execution Plan", deliverableType: "plan", required: true, clientFacing: true },
    ],
  },
  {
    id: SERVICE_IDS["military-talent-opportunity-assessment"],
    code: "military-talent-opportunity-assessment",
    name: "Military Talent Opportunity Assessment",
    practiceArea: "Military Talent",
    pricingModel: "fixed_project",
    minPrice: "15000",
    maxPrice: "45000",
    defaultDurationDays: 45,
    definition:
      "Assess whether a client workforce need can be served through military talent translation using stored, reviewed mappings.",
    scopeDefinition:
      "Civilian demand capture, military occupation translation, installation targeting, bridge training, and a human-reviewed opportunity plan.",
    requiredInputs: ["Civilian roles", "Locations", "Hiring volume", "Constraints"],
    deliverables: ["Military Talent Opportunity Plan", "Crosswalk", "Installation analysis", "Final report"],
    kpis: ["Roles analyzed", "High-fit roles", "Military mappings", "Installations", "Program recommendations"],
    clientResponsibilities: "Provide role inventory, location constraints, and a military reviewer counterpart if required.",
    firmResponsibilities: "Use stored mappings with provenance. Human military review before client delivery.",
    legalRequirements: "MSA, Military Talent Assessment SOW, NDA, DPA if applicable.",
    pricingGuidance: "Fixed project fee within the configured range.",
    expansionServices: ["fractional-talent-partner", "workforce-pipeline-assessment"],
    workflow: {
      qualificationTriggers: "Civilian workforce need that may be served by military talent.",
      dataCollection: "Roles, locations, SkillBridge interest, shortages, nearby military ecosystems.",
      aiResponsibilities: "Draft the opportunity plan from approved mappings and discovery. Do not invent occupations or coordinates.",
      humanResponsibilities: "Military Talent Partner review. Originating agent cannot approve.",
      approvalGates: "Human military review before client-facing plan, proposal, and deliverables.",
      deliverables: "Military Talent Opportunity Plan and supporting crosswalk.",
      legalPackage: {
        required: ["msa", "military_talent_assessment_sow", "nda"],
        conditional: ["dpa"],
      },
      projectTemplateCode: "military-talent-assessment-delivery",
      billingRules: "Milestone or contracted schedule billing events. No QuickBooks invoice unless configured.",
      kpis: "Roles analyzed, high-fit roles, mappings, installations.",
      completionRules: "Human-approved final report delivered; billing trigger created.",
      expansionRules: "Fractional TA or Workforce Pipeline when the assessment supports ongoing work.",
      exceptionHandling: "Unreviewed mappings stay pending and cannot be used in hiring-manager copy.",
      discoveryQuestions: [
        q("roles", "Roles / job families"),
        q("locations", "Locations"),
        q("technicalNeeds", "Technical workforce needs"),
        q("hiringVolume", "Hiring volume"),
        q("skillbridge", "SkillBridge interest", false),
        q("veteranGoals", "Veteran hiring goals", false),
        q("futureDemand", "Future demand"),
        q("knownShortages", "Known shortages"),
        q("recruitingProcess", "Client recruiting process"),
        q("workforceLocations", "Workforce locations"),
        q("nearbyMilitary", "Nearby military ecosystems", false),
      ],
    },
    steps: [
      {
        name: "Capture civilian roles and constraints",
        instructions: "Capture client civilian roles, locations, and constraints.",
        requiresHumanApproval: false,
        stepType: "discovery",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Roles and locations",
        outputType: "discovery",
        blocking: true,
        completionCriteria: "Discovery record stored.",
        exceptionPath: "Pause if role inventory is missing.",
      },
      {
        name: "Translate to military occupations",
        instructions: "Translate civilian demand to military occupations using stored, reviewed mappings.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Approved mappings",
        outputType: "crosswalk",
        blocking: true,
        completionCriteria: "Mappings referenced with source and version.",
        exceptionPath: "Do not invent occupations.",
      },
      {
        name: "Map skills, gaps, and training",
        instructions: "Map skills, certifications, gaps, and bridge training.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Crosswalk",
        outputType: "bridge_training",
        blocking: true,
        completionCriteria: "Gaps and training stored with provenance.",
        exceptionPath: "Do not promise employment.",
      },
      {
        name: "Identify likely installations",
        instructions: "Identify likely installations and bases from occupation–installation links.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Occupation-installation links",
        outputType: "installation_list",
        blocking: false,
        completionCriteria: "Installations come from stored links, not guesses.",
        exceptionPath: "Coordinates are never fabricated.",
      },
      {
        name: "Draft recommendations with provenance",
        instructions: "Produce recommendations as drafts with provenance.",
        requiresHumanApproval: false,
        stepType: "recommendation",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Analysis",
        outputType: "solution_plan_draft",
        blocking: true,
        completionCriteria: "Draft plan references the approved service version.",
        exceptionPath: "Agent drafts start pending.",
      },
      {
        name: "Human approval of client-facing output",
        instructions: "Require human approval before client-facing output.",
        requiresHumanApproval: true,
        stepType: "approval",
        responsibleRole: "military-talent-partner",
        requiredInputs: "Draft plan",
        outputType: "approved_plan",
        blocking: true,
        completionCriteria: "Human reviewer approved. Originating agent cannot approve.",
        exceptionPath: "Reject or request changes.",
      },
    ],
    projectPhases: [
      "Discovery",
      "Job Inventory",
      "Military Crosswalk",
      "Installation Analysis",
      "Workforce Opportunity Analysis",
      "Recommendations",
      "Human Review",
      "Client Presentation",
      "Final Report",
    ],
    projectDeliverables: [
      { name: "Military Talent Opportunity Plan", deliverableType: "plan", required: true, clientFacing: true },
      { name: "Final Report", deliverableType: "report", required: true, clientFacing: true },
    ],
  },
  {
    id: SERVICE_IDS["ta-performance-assessment"],
    code: "ta-performance-assessment",
    name: "TA Performance Assessment",
    practiceArea: "Talent Acquisition Operating",
    pricingModel: "fixed_project",
    minPrice: "18000",
    maxPrice: "40000",
    defaultDurationDays: 30,
    definition: "Evaluate a client's talent acquisition operating performance and recommend improvements.",
    scopeDefinition:
      "Collect TA operating data, score maturity dimensions, and produce a human-reviewed improvement plan. External TA tools remain integrations.",
    requiredInputs: ["Time to fill", "Funnel", "Recruiter workload", "Technology", "Governance"],
    deliverables: ["TA Performance Improvement Plan", "Maturity score", "30/60/90 roadmap"],
    kpis: ["TTF", "Aging", "Funnel", "Workload", "Agency spend", "Offer acceptance"],
    clientResponsibilities: "Provide operating data, process access, and stakeholder interviews.",
    firmResponsibilities: "Evidence-based findings. Human review of client-facing recommendations.",
    legalRequirements: "MSA, TA Performance Assessment SOW, NDA, DPA/security where required.",
    pricingGuidance: "Fixed project fee within the configured range.",
    expansionServices: ["fractional-talent-partner", "professional-search"],
    workflow: {
      qualificationTriggers: "Client wants an operating assessment of talent acquisition, not staffing payroll.",
      dataCollection: "TTF, aging, funnel, workload, agency spend, technology, governance.",
      aiResponsibilities: "Draft maturity commentary from discovery answers. Do not invent metrics.",
      humanResponsibilities: "Workforce consultant validates findings before client delivery.",
      approvalGates: "Human review of client-facing findings, proposal, and deliverables.",
      deliverables: "TA Performance Improvement Plan.",
      legalPackage: {
        required: ["msa", "ta_performance_assessment_sow", "nda"],
        conditional: ["dpa"],
      },
      projectTemplateCode: "ta-performance-assessment-delivery",
      billingRules: "Milestone-based or contracted schedule.",
      kpis: "TTF, aging, funnel, workload, agency spend, offer acceptance, process delays.",
      completionRules: "Approved executive presentation delivered; billing trigger created.",
      expansionRules: "Fractional Talent Partner or recruiting transformation follow-on.",
      exceptionHandling: "Missing data is recorded as missing; do not fabricate KPI values.",
      discoveryQuestions: [
        q("timeToFill", "Time to fill"),
        q("recruiterWorkload", "Recruiter workload"),
        q("requisitionAging", "Requisition aging"),
        q("funnelConversion", "Funnel conversion"),
        q("offerAcceptance", "Offer acceptance"),
        q("agencySpend", "Agency spend"),
        q("sourcingPerformance", "Sourcing performance"),
        q("candidateExperience", "Candidate experience"),
        q("managerSatisfaction", "Manager satisfaction"),
        q("processDelays", "Process delays"),
        q("technology", "Technology"),
        q("analytics", "Analytics"),
        q("governance", "Governance"),
        q("vendorManagement", "Vendor management"),
      ],
    },
    steps: [
      {
        name: "Collect TA operating data",
        instructions: "Collect talent acquisition operating data and current process.",
        requiresHumanApproval: false,
        stepType: "discovery",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Operating metrics",
        outputType: "discovery",
        blocking: true,
        completionCriteria: "Discovery answers stored. Missing data flagged.",
        exceptionPath: "Do not fabricate metrics.",
      },
      {
        name: "Analyze funnel and sourcing mix",
        instructions: "Analyze funnel, sourcing mix, and internal talent reuse.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Discovery",
        outputType: "current_state",
        blocking: true,
        completionCriteria: "Current-state findings drafted from collected data.",
        exceptionPath: "Incomplete data stays listed as missing.",
      },
      {
        name: "Recommend operating changes",
        instructions: "Recommend operating changes as drafts.",
        requiresHumanApproval: false,
        stepType: "recommendation",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Analysis",
        outputType: "improvement_plan_draft",
        blocking: true,
        completionCriteria: "Draft uses the approved service version.",
        exceptionPath: "Do not invent service policies.",
      },
      {
        name: "Human review of findings",
        instructions: "Human review of client-facing findings.",
        requiresHumanApproval: true,
        stepType: "approval",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Draft plan",
        outputType: "approved_plan",
        blocking: true,
        completionCriteria: "Human approved client-facing findings.",
        exceptionPath: "Return for changes.",
      },
      {
        name: "Optional implementation project",
        instructions: "Create an implementation project from an approved plan when requested.",
        requiresHumanApproval: false,
        stepType: "project",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Approved plan and executed contract",
        outputType: "delivery_project",
        blocking: false,
        completionCriteria: "Delivery project created from workflow template.",
        exceptionPath: "Contract gate applies.",
      },
    ],
    projectPhases: [
      "Discovery",
      "Data Collection",
      "Process Mapping",
      "Maturity Assessment",
      "Root-Cause Analysis",
      "Future State",
      "Roadmap",
      "Executive Presentation",
    ],
    projectDeliverables: [
      { name: "TA Performance Improvement Plan", deliverableType: "plan", required: true, clientFacing: true },
      { name: "Executive Presentation", deliverableType: "presentation", required: true, clientFacing: true },
    ],
  },
  {
    id: SERVICE_IDS["fractional-talent-partner"],
    code: "fractional-talent-partner",
    name: "Fractional Talent Partner",
    practiceArea: "Fractional Talent Leadership",
    pricingModel: "monthly_recurring",
    minPrice: "8000",
    maxPrice: "25000",
    defaultDurationDays: 180,
    definition: "Ongoing fractional talent leadership and operating support. Not temp staffing or payroll.",
    scopeDefinition:
      "Scoped operating responsibilities, cadence, covered and excluded roles, capacity, and governance. Never unlimited recruiting.",
    requiredInputs: ["Open reqs", "Hiring forecast", "Recruiter capacity", "SLA expectations", "Excluded work"],
    deliverables: ["Fractional TA Operating Plan", "Weekly reporting", "Monthly review"],
    kpis: ["Active reqs", "Intake SLA", "Shortlist SLA", "Fill rate", "Capacity", "Stakeholder satisfaction"],
    clientResponsibilities: "Access to systems, hiring managers, and timely requisition intake.",
    firmResponsibilities: "Operate inside the scoped capacity and cadence. Escalate when demand exceeds capacity.",
    legalRequirements: "MSA, Fractional TA SOW, NDA, DPA, system access/confidentiality.",
    pricingGuidance: "Monthly recurring fee within the configured range. Capacity is finite.",
    expansionServices: [
      "professional-search",
      "military-talent-opportunity-assessment",
      "workforce-pipeline-assessment",
    ],
    workflow: {
      qualificationTriggers: "Client needs fractional talent leadership, not a staffing payroll engine.",
      dataCollection: "Reqs, forecast, capacity, excluded work, cadence, access requirements.",
      aiResponsibilities: "Draft operating plan from discovery. Never describe unlimited recruiting.",
      humanResponsibilities: "Talent partner approves scope, legal package, and capacity model.",
      approvalGates: "Engagement plan, pricing, contract, and client-facing deliverables.",
      deliverables: "Fractional TA Operating Plan and recurring reporting.",
      legalPackage: {
        required: ["msa", "fractional_ta_sow", "nda", "dpa", "confidentiality_ip_agreement"],
        conditional: [],
      },
      projectTemplateCode: "fractional-talent-partner-delivery",
      billingRules: "Monthly billing events from the contract value / cadence.",
      kpis: "Active reqs, SLAs, fill rate, capacity, stakeholder satisfaction.",
      completionRules: "Renewal/expansion review completed; open issues documented.",
      expansionRules: "Professional Search or assessments when scope is exceeded.",
      exceptionHandling: "Demand above capacity is an exception, not silent over-commitment.",
      discoveryQuestions: [
        q("openReqs", "Number of open requisitions"),
        q("hiringForecast", "Hiring forecast"),
        q("recruiterCapacity", "Recruiter capacity"),
        q("businessUnits", "Business units"),
        q("roleTypes", "Role types"),
        q("hiringManagers", "Hiring managers"),
        q("urgency", "Urgency"),
        q("technologies", "Technologies"),
        q("reportingRequirements", "Reporting requirements"),
        q("slaExpectations", "SLA expectations"),
        q("excludedWork", "Excluded work"),
        q("expectedCadence", "Expected cadence"),
        q("clientAccess", "Client access requirements"),
      ],
    },
    steps: [
      {
        name: "Scope operating responsibilities",
        instructions: "Scope operating responsibilities and cadence. This is not temp staffing or payroll.",
        requiresHumanApproval: false,
        stepType: "discovery",
        responsibleRole: "talent-partner",
        requiredInputs: "Capacity and exclusions",
        outputType: "discovery",
        blocking: true,
        completionCriteria: "Covered and excluded work are explicit.",
        exceptionPath: "Reject unlimited recruiting framing.",
      },
      {
        name: "Approve engagement plan",
        instructions: "Approve the engagement plan and linked legal package.",
        requiresHumanApproval: true,
        stepType: "approval",
        responsibleRole: "talent-partner",
        requiredInputs: "Operating plan",
        outputType: "approved_plan",
        blocking: true,
        completionCriteria: "Human-approved plan and legal package.",
        exceptionPath: "Do not start delivery without contract or override.",
      },
      {
        name: "Run recurring talent operations",
        instructions: "Run recurring talent operating work inside WorkforceOS.",
        requiresHumanApproval: false,
        stepType: "project",
        responsibleRole: "talent-partner",
        requiredInputs: "Active project",
        outputType: "operating_cadence",
        blocking: true,
        completionCriteria: "Weekly reporting tasks exist.",
        exceptionPath: "Escalate capacity breaches.",
      },
      {
        name: "Review outcomes with the client",
        instructions: "Review outcomes with the client on a defined cadence.",
        requiresHumanApproval: false,
        stepType: "closeout",
        responsibleRole: "talent-partner",
        requiredInputs: "KPI snapshot",
        outputType: "monthly_review",
        blocking: false,
        completionCriteria: "Monthly review recorded.",
        exceptionPath: "Document unresolved issues.",
      },
    ],
    projectPhases: [
      "Onboarding",
      "Capacity Setup",
      "Requisition Intake",
      "Recruiting Operations",
      "Weekly Reporting",
      "Monthly Review",
      "Capacity Review",
      "Renewal/Expansion",
    ],
    projectDeliverables: [
      { name: "Fractional TA Operating Plan", deliverableType: "plan", required: true, clientFacing: true },
      { name: "Monthly Review", deliverableType: "report", required: true, clientFacing: true },
    ],
  },
  {
    id: SERVICE_IDS["workforce-pipeline-assessment"],
    code: "workforce-pipeline-assessment",
    name: "Workforce Pipeline Assessment",
    practiceArea: "Workforce Planning",
    pricingModel: "fixed_project",
    minPrice: "20000",
    maxPrice: "55000",
    defaultDurationDays: 60,
    definition: "Assess current and future workforce supply against demand and recommend pipeline actions.",
    scopeDefinition:
      "Demand, supply, gap, military overlay, education/training, and scenarios. Not the full workforce intelligence engine.",
    requiredInputs: ["Headcount", "Job families", "Locations", "Hiring forecast", "Skills"],
    deliverables: ["Workforce Pipeline Plan", "Gap analysis", "Scenario summary"],
    kpis: ["Forecast need", "Gap", "Pipeline capacity", "Training", "Hiring conversion", "Internal mobility"],
    clientResponsibilities: "Provide workforce data, constraints, and decision-maker access.",
    firmResponsibilities: "Human-reviewed recommendations. Do not fabricate forecasts.",
    legalRequirements: "MSA, Workforce Assessment SOW, NDA, DPA/security/data-transfer where required.",
    pricingGuidance: "Fixed project fee within the configured range.",
    expansionServices: [
      "military-talent-opportunity-assessment",
      "fractional-talent-partner",
      "professional-search",
    ],
    workflow: {
      qualificationTriggers: "Client needs a pipeline assessment of supply versus demand.",
      dataCollection: "Headcount, attrition, forecast, skills, military supply, apprenticeships.",
      aiResponsibilities: "Draft gap narrative from discovery. Do not invent headcount or forecasts.",
      humanResponsibilities: "Workforce consultant approves client-facing recommendations.",
      approvalGates: "Human approval of plan, proposal, and deliverables.",
      deliverables: "Workforce Pipeline Plan.",
      legalPackage: {
        required: ["msa", "workforce_assessment_sow", "nda"],
        conditional: ["dpa"],
      },
      projectTemplateCode: "workforce-pipeline-assessment-delivery",
      billingRules: "Milestone-based billing events.",
      kpis: "Forecast need, gap, pipeline capacity, training, conversion, mobility, military/apprenticeship contribution.",
      completionRules: "Approved executive presentation; expansion suggestions created for human review.",
      expansionRules: "Military program, fractional TA, or professional search as follow-on.",
      exceptionHandling: "Missing workforce data is documented; KPIs are not fabricated.",
      discoveryQuestions: [
        q("headcount", "Headcount"),
        q("jobFamilies", "Job families"),
        q("locations", "Locations"),
        q("attrition", "Attrition"),
        q("retirementRisk", "Retirement risk", false),
        q("hiringForecast", "Hiring forecast"),
        q("growth", "Growth"),
        q("skills", "Skills"),
        q("compensation", "Compensation", false),
        q("training", "Training"),
        q("internalMobility", "Internal mobility", false),
        q("careerPaths", "Career paths", false),
        q("educationPartners", "Education partners", false),
        q("militarySupply", "Military supply", false),
        q("apprenticeship", "Apprenticeship activity", false),
        q("constraints", "Workforce constraints"),
      ],
    },
    steps: [
      {
        name: "Collect workforce and demand signals",
        instructions: "Collect current workforce and demand signals.",
        requiresHumanApproval: false,
        stepType: "discovery",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Workforce data",
        outputType: "discovery",
        blocking: true,
        completionCriteria: "Discovery stored with missing-data notes.",
        exceptionPath: "Do not fabricate headcount.",
      },
      {
        name: "Map occupations and skills",
        instructions: "Map occupations and skills.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Job families",
        outputType: "occupation_map",
        blocking: true,
        completionCriteria: "Occupations referenced from WorkforceOS records where available.",
        exceptionPath: "Unknown occupations stay listed as unknown.",
      },
      {
        name: "Forecast gaps",
        instructions: "Forecast supply and demand gaps.",
        requiresHumanApproval: false,
        stepType: "analysis",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Demand and supply inputs",
        outputType: "gap_analysis",
        blocking: true,
        completionCriteria: "Gaps described from provided data only.",
        exceptionPath: "Missing inputs remain in missing data.",
      },
      {
        name: "Recommend pipeline actions",
        instructions: "Recommend pipeline actions as drafts.",
        requiresHumanApproval: false,
        stepType: "recommendation",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Gap analysis",
        outputType: "pipeline_plan_draft",
        blocking: true,
        completionCriteria: "Draft uses approved workflow and version.",
        exceptionPath: "Do not invent service policies.",
      },
      {
        name: "Human approval of recommendations",
        instructions: "Human approval of client-facing recommendations.",
        requiresHumanApproval: true,
        stepType: "approval",
        responsibleRole: "workforce-consultant",
        requiredInputs: "Draft plan",
        outputType: "approved_plan",
        blocking: true,
        completionCriteria: "Human approved recommendations.",
        exceptionPath: "Return for changes.",
      },
    ],
    projectPhases: [
      "Discovery",
      "Workforce Data",
      "Demand Analysis",
      "Supply Analysis",
      "Gap Analysis",
      "Military Overlay",
      "Pipeline Design",
      "Scenario Analysis",
      "Human Review",
      "Executive Presentation",
    ],
    projectDeliverables: [
      { name: "Workforce Pipeline Plan", deliverableType: "plan", required: true, clientFacing: true },
      { name: "Executive Presentation", deliverableType: "presentation", required: true, clientFacing: true },
    ],
  },
];

export function catalogByCode(code: string) {
  return LAUNCH_SERVICE_CATALOG.find((row) => row.code === code);
}
