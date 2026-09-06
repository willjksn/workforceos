import { eq, ilike, or } from "drizzle-orm";

import { getDb } from "../../db";
import { civilianOccupations, companies } from "../../db/schema";
import { getServerEnv } from "../env";
import { isApolloConfigured } from "../integrations/credentials";
import { getSeekOutAdapter } from "../integrations/providers";
import { lookupLaborMarket } from "../integrations/labor-market";
import { canOpenExternalSourcing } from "../recruiting/external-sourcing";
import { getMilitaryOccupationBundle, listMilitaryOccupations, reverseSearchCivilianToMilitary } from "../repositories/military";
import { SOURCE_LABELS, provenanceRecord, type SourceProvenance, type SourceType } from "./provenance";

export type IntelligenceFinding = {
  title: string;
  summary: string;
  sourceType: SourceType;
  sourceLabel: string;
  provenance: SourceProvenance;
  href?: string;
  proposedAction?: "create_signal" | "create_prospect" | "dismiss" | null;
  overwritesInternal: false;
};

export type CompanyIntelligenceProvider = {
  enrichCompany(input: { organizationId: string; companyId?: string; name?: string }): Promise<IntelligenceFinding[]>;
};

export type ContactIntelligenceProvider = {
  discoverContacts(input: { organizationId: string; companyId: string }): Promise<IntelligenceFinding[]>;
};

export type OccupationReferenceProvider = {
  lookupOccupation(query: string): Promise<IntelligenceFinding[]>;
};

export type LaborMarketProvider = {
  lookup(input: { geography?: string; occupationCode?: string; metric: string }): Promise<IntelligenceFinding[]>;
};

export type TalentSourcingProvider = {
  searchExternal(input: {
    jobId: string;
    query: string;
    internalSearchCompletedAt: Date | null | undefined;
  }): Promise<{ allowed: boolean; reason: string; findings: IntelligenceFinding[] }>;
};

export type MilitaryReferenceProvider = {
  lookupAlignment(input: { organizationId: string; query: string }): Promise<IntelligenceFinding[]>;
};

function finding(input: {
  title: string;
  summary: string;
  sourceType: SourceType;
  provider: string;
  href?: string;
  url?: string | null;
  version?: string | null;
  proposedAction?: IntelligenceFinding["proposedAction"];
}): IntelligenceFinding {
  return {
    title: input.title,
    summary: input.summary,
    sourceType: input.sourceType,
    sourceLabel: SOURCE_LABELS[input.sourceType],
    href: input.href,
    proposedAction: input.proposedAction ?? null,
    overwritesInternal: false,
    provenance: provenanceRecord({
      provider: input.provider,
      sourceType: input.sourceType,
      url: input.url ?? null,
      sourceVersion: input.version ?? null,
      retrievedAt: new Date(),
    }),
  };
}

export class ApolloProvider implements CompanyIntelligenceProvider, ContactIntelligenceProvider {
  async enrichCompany(input: { organizationId: string; companyId?: string; name?: string }) {
    const db = getDb();
    if (input.companyId) {
      const [company] = await db.select().from(companies).where(eq(companies.id, input.companyId)).limit(1);
      if (company) {
        return [
          finding({
            title: company.name,
            summary: `WorkforceOS CRM record. Apollo may propose enrichment for empty fields only.`,
            sourceType: "INTERNAL_WORKFORCEOS",
            provider: "workforceos",
            href: `/app/crm/companies/${company.id}`,
          }),
          finding({
            title: `${company.name} (Apollo)`,
            summary: isApolloConfigured()
              ? "Apollo is the structured company/contact provider. Proposed fields require human review and do not overwrite verified CRM data."
              : "Apollo adapter is registered. Credentials optional. Proposed enrichment still requires human review.",
            sourceType: "APOLLO",
            provider: "apollo",
            proposedAction: "create_prospect",
          }),
        ];
      }
    }
    return [
      finding({
        title: input.name ?? "Company enrichment",
        summary: "Apollo structured intelligence is preferred over general web search for firmographics and buyer discovery.",
        sourceType: "APOLLO",
        provider: "apollo",
        proposedAction: "create_prospect",
      }),
    ];
  }

  async discoverContacts(input: { organizationId: string; companyId: string }) {
    return this.enrichCompany(input);
  }
}

export class OnetOccupationProvider implements OccupationReferenceProvider {
  async lookupOccupation(query: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(civilianOccupations)
      .where(or(ilike(civilianOccupations.title, `%${query}%`), ilike(civilianOccupations.onetCode, `%${query}%`)))
      .limit(8);
    if (rows.length === 0) {
      return [
        finding({
          title: "O*NET reference",
          summary: `No stored occupation matched “${query}”. Live O*NET is not called per UI request; import/sync through Integration Hub.`,
          sourceType: "ONET",
          provider: "onet",
          version: "internal-copy",
        }),
      ];
    }
    return rows.map((row) =>
      finding({
        title: row.title,
        summary: row.description ?? `Stored O*NET occupation ${row.onetCode ?? row.code}.`,
        sourceType: "ONET",
        provider: "onet",
        href: `/app/military/occupations`,
        version: row.onetVersion,
      }),
    );
  }
}

export class BlsCensusLaborMarketProvider implements LaborMarketProvider {
  async lookup(input: { geography?: string; occupationCode?: string; metric: string }) {
    const bls = await lookupLaborMarket({
      provider: "bls",
      geography: input.geography,
      occupationCode: input.occupationCode,
      metric: input.metric,
    });
    const census = await lookupLaborMarket({
      provider: "census",
      geography: input.geography,
      occupationCode: input.occupationCode,
      metric: input.metric,
    });
    return [
      finding({
        title: `BLS ${input.metric}`,
        summary: bls.notes,
        sourceType: "BLS",
        provider: "bls",
        version: bls.sourceVersion,
      }),
      finding({
        title: `Census/LEHD ${input.metric}`,
        summary: census.notes,
        sourceType: "CENSUS",
        provider: "census",
        version: census.sourceVersion,
      }),
    ];
  }
}

export class SeekOutHireEzSourcingProvider implements TalentSourcingProvider {
  async searchExternal(input: {
    jobId: string;
    query: string;
    internalSearchCompletedAt: Date | null | undefined;
  }) {
    if (!canOpenExternalSourcing(input.internalSearchCompletedAt)) {
      return {
        allowed: false,
        reason: "Internal Talent Network search must be completed before SeekOut/hireEZ.",
        findings: [],
      };
    }
    const env = getServerEnv();
    const provider = env.TALENT_SOURCING_PROVIDER === "hireez" ? "hireez" : "seekout";
    if (provider === "hireez") {
      return {
        allowed: true,
        reason: "hireEZ adapter is registered behind Integration Hub.",
        findings: [
          finding({
            title: "hireEZ sourcing",
            summary: "External sourcing placeholder. Import requires human review. LinkedIn is not scraped.",
            sourceType: "HIRE_EZ",
            provider: "hireez",
          }),
        ],
      };
    }
    const lookup = getSeekOutAdapter().lookupCandidates({
      jobId: input.jobId,
      internalSearchCompletedAt: input.internalSearchCompletedAt,
      query: input.query,
    });
    return {
      allowed: lookup.allowed,
      reason: "SeekOut is the preferred external sourcing adapter after internal search.",
      findings: lookup.results.map((row) =>
        finding({
          title: row.displayName,
          summary: row.notes,
          sourceType: "SEEKOUT",
          provider: "seekout",
        }),
      ),
    };
  }
}

export class ApprovedMilitaryReferenceProvider implements MilitaryReferenceProvider {
  async lookupAlignment(input: { organizationId: string; query: string }) {
    const findings: IntelligenceFinding[] = [];
    const code = /\bem\b|electrician'?s mate/i.test(input.query) ? "EM" : undefined;
    if (code) {
      const bundle = await getMilitaryOccupationBundle(code);
      if (bundle) {
        for (const role of bundle.civilianRoles) {
          findings.push(
            finding({
              title: `${bundle.occupation.code} → ${role.occupation.title}`,
              summary: `Approved WorkforceOS mapping (${role.mapping.reviewStatus}). ${role.mapping.explanation ?? "Military facts follow approved mappings, not general web search."}`,
              sourceType: "MILITARY_OFFICIAL",
              provider: "workforceos-military",
              href: `/app/military/${bundle.occupation.id}`,
              version: role.mapping.sourceVersion,
            }),
          );
        }
      }
    }
    const reverse = await reverseSearchCivilianToMilitary(input.query);
    for (const row of reverse.slice(0, 6)) {
      findings.push(
        finding({
          title: `${row.military.code} → ${row.civilian.title}`,
          summary: `Approved mapping (${row.mapping.reviewStatus}). Web research cannot overwrite this record.`,
          sourceType: "MILITARY_OFFICIAL",
          provider: "workforceos-military",
          version: row.mapping.sourceVersion,
        }),
      );
    }
    if (findings.length === 0) {
      const occupations = await listMilitaryOccupations(input.query);
      for (const occupation of occupations.slice(0, 5)) {
        findings.push(
          finding({
            title: `${occupation.code} ${occupation.title}`,
            summary: "Stored military occupation. Civilian alignment uses approved mappings and O*NET, not live web overwrite.",
            sourceType: "MILITARY_OFFICIAL",
            provider: "workforceos-military",
            href: `/app/military/${occupation.id}`,
          }),
        );
      }
    }
    if (findings.length === 0) {
      return [
        finding({
          title: "Military reference",
          summary: "No approved mapping matched this query. OpenAI web search and Tavily must not overwrite military mappings.",
          sourceType: "MILITARY_OFFICIAL",
          provider: "workforceos-military",
        }),
      ];
    }
    return findings;
  }
}

export function getCompanyIntelligenceProvider(): CompanyIntelligenceProvider {
  return new ApolloProvider();
}
export function getOccupationReferenceProvider(): OccupationReferenceProvider {
  return new OnetOccupationProvider();
}
export function getLaborMarketProvider(): LaborMarketProvider {
  return new BlsCensusLaborMarketProvider();
}
export function getTalentSourcingProvider(): TalentSourcingProvider {
  return new SeekOutHireEzSourcingProvider();
}
export function getMilitaryReferenceProvider(): MilitaryReferenceProvider {
  return new ApprovedMilitaryReferenceProvider();
}

export function webFindingCannotOverwriteInternal() {
  return true;
}
