export type LegalPackageSpec = {
  required: string[];
  conditional: string[];
};

export const SERVICE_LEGAL_PACKAGES: Record<string, LegalPackageSpec> = {
  "professional-search": {
    required: ["direct_hire_search_agreement"],
    conditional: ["msa", "nda", "dpa", "retained_search_agreement"],
  },
  "military-talent-opportunity-assessment": {
    required: ["msa", "military_talent_assessment_sow", "nda"],
    conditional: ["dpa"],
  },
  "ta-performance-assessment": {
    required: ["msa", "ta_performance_assessment_sow", "nda"],
    conditional: ["dpa"],
  },
  "fractional-talent-partner": {
    required: ["msa", "fractional_ta_sow", "nda", "dpa", "confidentiality_ip_agreement"],
    conditional: [],
  },
  "workforce-pipeline-assessment": {
    required: ["msa", "workforce_assessment_sow", "nda"],
    conditional: ["dpa"],
  },
};

export function legalPackageForService(
  stored: LegalPackageSpec | null | undefined,
  serviceCode: string,
): LegalPackageSpec {
  if (stored?.required?.length) return stored;
  return SERVICE_LEGAL_PACKAGES[serviceCode] ?? { required: ["msa"], conditional: ["nda"] };
}

export function primaryContractType(spec: LegalPackageSpec) {
  return spec.required[0] ?? "msa";
}
