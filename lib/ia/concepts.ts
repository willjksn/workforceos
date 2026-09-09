export const OPERATING_CONCEPTS = {
  candidateVsApplication: {
    title: "Candidate vs application",
    body: "A candidate is the one person in the Talent Network. An application is that person applying to one job. Do not create a second candidate because they applied again.",
    academySlug: "operating-concepts",
  },
  jobVsRequisitionVsPosting: {
    title: "Job vs requisition vs posting",
    body: "A job is the recruiting assignment. A headcount request (requisition) is optional intake before that job opens. A posting is the public careers listing of the same job — not a second search.",
    academySlug: "operating-concepts",
  },
  employerOpportunityVsJob: {
    title: "Employer opportunity vs job",
    body: "An employer opportunity is a host/employer SkillBridge-eligible opening PierOne facilitates. A job is a recruiting search assignment. Matching can start before a public posting exists.",
    academySlug: "operating-concepts",
  },
  programVsProjectVsEngagement: {
    title: "Program vs project vs engagement",
    body: "A delivery project is consulting work after an executed contract. A search project is the internal-first work on a job. An engagement is the commercial relationship (opportunity → proposal → contract). SkillBridge is a pathway type, not a PierOne-owned program.",
    academySlug: "operating-concepts",
  },
  solutionVsProposalVsSow: {
    title: "Solution vs proposal vs SOW",
    body: "A solution plan is the internal recommended offer. A proposal is the client-facing version after the plan is approved. A SOW lives on the contract after the client accepts.",
    academySlug: "operating-concepts",
  },
  templateVsAgreementVsContract: {
    title: "Template vs agreement vs contract",
    body: "A template is reusable language. ATTORNEY APPROVED means counsel recorded approval; otherwise it is DRAFT — NOT APPROVED FOR USE. An agreement/contract is the client package created from an accepted proposal.",
    academySlug: "operating-concepts",
  },
  addCompany: {
    title: "Add a company",
    body: "Add a company on Companies. Command Center and Scout do not create company records.",
    academySlug: "module-companies",
  },
  financeSpine: {
    title: "Operating finance spine",
    body: "Proposal pricing becomes contract value, then project value, invoice, AR, payment, and revenue reporting. WorkforceOS is not the general ledger.",
    academySlug: "module-finance",
  },
} as const;

export const FINANCE_SPINE = [
  { label: "Proposal Pricing", href: "/app/proposals" },
  { label: "Contract Value", href: "/app/contracts" },
  { label: "Project Value", href: "/app/projects" },
  { label: "Invoice", href: "/app/finance/invoices" },
  { label: "AR", href: "/app/finance/ar" },
  { label: "Payment", href: "/app/finance/payments" },
  { label: "Revenue Reporting", href: "/app/finance/revenue" },
] as const;
