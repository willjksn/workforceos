export type OccupationImportRecord = {
  branch: "army" | "navy" | "air_force" | "marine_corps" | "coast_guard" | "space_force";
  classificationType: "mos" | "rating" | "afsc" | "specialty";
  code: string;
  title: string;
  description?: string;
  careerField?: string;
  source: string;
  sourceVersion: string;
  sourceUrl?: string;
};

export type OccupationImporter = {
  source: string;
  load(): Promise<OccupationImportRecord[]>;
};

export type ImportSummary = {
  source: string;
  sourceVersion: string;
  upserted: number;
  skipped: number;
  preservedApprovedMappings: true;
};

export function summarizeImport(input: {
  source: string;
  sourceVersion: string;
  upserted: number;
  skipped: number;
}): ImportSummary {
  return { ...input, preservedApprovedMappings: true };
}

export const fixtureOccupationImporter: OccupationImporter = {
  source: "development_fixture",
  async load() {
    return [
      {
        branch: "navy",
        classificationType: "rating",
        code: "EM",
        title: "Electrician's Mate",
        description: "Development fixture. Not an official Navy rating extract.",
        careerField: "engineering",
        source: "development_fixture",
        sourceVersion: "phase3-dev",
      },
    ];
  },
};
