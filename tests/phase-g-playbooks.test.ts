import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

const PLAYBOOKS = [
  "professional-search.md",
  "military-talent-opportunity-assessment.md",
  "talent-acquisition-performance-assessment.md",
  "fractional-talent-partner.md",
  "workforce-pipeline-assessment.md",
  "military-transition-pathway.md",
  "recruiting-and-hiring.md",
  "client-discovery.md",
  "proposal-contract-handoff.md",
  "project-delivery-closeout.md",
] as const;

const KNOWLEDGE_SLUGS = [
  "professional-search-playbook",
  "military-talent-opportunity-assessment-playbook",
  "ta-performance-assessment-playbook",
  "fractional-talent-partner-playbook",
  "workforce-pipeline-assessment-playbook",
  "military-transition-pathway-playbook",
  "recruiting-hiring-playbook",
  "client-discovery-playbook",
  "proposal-contract-handoff-playbook",
  "project-delivery-closeout-playbook",
] as const;

const FAKE_ROUTES = [
  "/app/qualification",
  "/app/expansion",
  "/app/screening",
  "/app/matching",
  "/app/submissions/[id]",
  "/app/interviews/[id]",
  "/app/offers/[id]",
  "/app/placements/[id]",
  "/app/finance/invoices/[id]",
  "/app/military/opportunities/[id]",
  "/app/military/candidates/[id]",
  "/app/military/match",
];

const STEP_FIELDS = [
  "**WorkforceOS screen**",
  "**Required data**",
  "**Owner**",
  "**Access / permission**",
  "**Approval**",
  "**Scout prompt**",
  "**Deliverable**",
  "**Next step**",
];

function readDoc(relative: string) {
  return readFileSync(path.join(root, relative), "utf8");
}

describe("Phase G service delivery playbooks", () => {
  it("publishes the index plus ten playbook files", () => {
    expect(existsSync(path.join(root, "docs/business/SERVICE_PLAYBOOKS.md"))).toBe(true);
    expect(existsSync(path.join(root, "docs/business/playbooks/README.md"))).toBe(true);
    for (const file of PLAYBOOKS) {
      expect(existsSync(path.join(root, "docs/business/playbooks", file)), file).toBe(true);
    }
  });

  it("maps every required field and cites approved sources", () => {
    const index = readDoc("docs/business/SERVICE_PLAYBOOKS.md");
    expect(index).toMatch(/Professional Search/);
    expect(index).toMatch(/Military Talent Opportunity Assessment/);
    expect(index).toMatch(/Talent Acquisition Performance Assessment/);
    expect(index).toMatch(/Fractional Talent Partner/);
    expect(index).toMatch(/Workforce Pipeline Assessment/);
    expect(index).toMatch(/not a sixth client offer/i);

    for (const file of PLAYBOOKS) {
      const text = readDoc(`docs/business/playbooks/${file}`);
      for (const field of STEP_FIELDS) {
        expect(text.includes(field), `${file} missing ${field}`).toBe(true);
      }
      expect(
        /SERVICE_WORKFLOWS|SERVICE_CATALOG|PIERONE_OPERATING_MANUAL|DEC-MIL-005/.test(text),
        `${file} must cite an approved source`,
      ).toBe(true);
      expect(text).not.toMatch(/Military Talent Specialist/);
      expect(text).not.toMatch(/\bcandidate\.read\b/);
      expect(text).toMatch(/candidates\.read|opportunities\.read|discovery\.read|proposals\.read|projects\.read|skillbridge\.read|workforce\.read/);
    }
  });

  it("does not invent detail URLs that are not live", () => {
    const files = [
      "docs/business/SERVICE_PLAYBOOKS.md",
      "docs/business/playbooks/README.md",
      ...PLAYBOOKS.map((file) => `docs/business/playbooks/${file}`),
    ];
    const corpus = files.map((file) => readDoc(file)).join("\n");

    for (const route of FAKE_ROUTES) {
      const lines = corpus.split("\n").filter((line) => line.includes(route));
      expect(lines.length, `document the gap for ${route}`).toBeGreaterThan(0);
      for (const line of lines) {
        expect(
          /\bno\b|\bnot\b|\bnever\b|\bmissing\b|\bnone\b|do not |redirects/i.test(line),
          `line treats ${route} as live: ${line}`,
        ).toBe(true);
      }
    }

    expect(corpus).toMatch(/Scout cannot send|Scout send is still denied|external send is denied/i);
    expect(corpus).not.toMatch(/SELECT\s+\*\s+FROM/i);
  });

  it("seeds Scout knowledge slugs without candidate PII", () => {
    const seed = readDoc("db/seed/phase7.ts");
    for (const slug of KNOWLEDGE_SLUGS) {
      expect(seed.includes(`slug: "${slug}"`), slug).toBe(true);
    }
    expect(seed).not.toMatch(/@pierone|555-|ssn|social security/i);
    expect(seed).toMatch(/knowledgeType: "service_playbook"/);
  });

  it("leaves the engineering operating playbook as the deploy/recover SoR", () => {
    const playbook = readDoc("docs/operations/WORKFORCEOS_OPERATING_PLAYBOOK.md");
    expect(playbook).toMatch(/PITR|point-in-time/i);
    expect(playbook).toMatch(/rollback/i);
    expect(playbook).not.toMatch(/docs\/business\/playbooks\/professional-search/);
  });
});
