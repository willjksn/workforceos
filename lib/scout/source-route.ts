export const SCOUT_SOURCE_KINDS = [
  "INTERNAL_SEARCH",
  "INTERNAL_SUMMARY",
  "INTERNAL_ACTION",
  "REFERENCE_LOOKUP",
  "WEB_SEARCH",
  "DEEP_WEB_RESEARCH",
  "STRUCTURED_EXTERNAL_LOOKUP",
  "HYBRID_RESEARCH",
  "DRAFT_MESSAGE",
  "UNKNOWN",
] as const;

export type ScoutSourceKind = (typeof SCOUT_SOURCE_KINDS)[number];

export type StructuredDomain =
  | "apollo"
  | "onet"
  | "bls"
  | "census"
  | "military"
  | "talent_sourcing"
  | null;

export type ScoutSourceRoute = {
  kind: ScoutSourceKind;
  allowWeb: boolean;
  preferWebProvider: "openai" | "tavily" | null;
  structuredDomain: StructuredDomain;
  reason: string;
};

function isInternalTalentOrQueue(text: string) {
  return (
    /\bskillbridge\b/.test(text) ||
    /\bwho needs follow-?up\b/.test(text) ||
    /\bfollow-?up today\b/.test(text) ||
    /\bwithout (an )?opportunit/.test(text) ||
    /\bno employer opportunit/.test(text) ||
    /\bshow me (electrical )?technicians\b/.test(text) ||
    /\bin (our|the) talent network\b/.test(text) ||
    /\bmy queue\b/.test(text)
  );
}

export function classifyScoutSource(prompt: string): ScoutSourceRoute {
  const text = prompt.trim().toLowerCase();
  if (!text) {
    return { kind: "UNKNOWN", allowWeb: false, preferWebProvider: null, structuredDomain: null, reason: "Empty prompt." };
  }

  if (/\bdraft\b/.test(text) && /\b(email|message|outreach|follow-?up)\b/.test(text)) {
    return { kind: "DRAFT_MESSAGE", allowWeb: false, preferWebProvider: null, structuredDomain: null, reason: "Message drafting stays on stored records." };
  }
  if (/\b(create|update|assign|add to pool|add to job|follow-?up task)\b/.test(text)) {
    return { kind: "INTERNAL_ACTION", allowWeb: false, preferWebProvider: null, structuredDomain: null, reason: "Internal operating action." };
  }

  if (
    /\bcivilian occupation/.test(text) ||
    /\balign with\b/.test(text) && /\b(navy|army|marine|air force|coast guard|em)\b/.test(text) ||
    /\bmilitary[- ]civilian\b/.test(text) ||
    /\bnavy em\b/.test(text)
  ) {
    return {
      kind: "REFERENCE_LOOKUP",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: "military",
      reason: "Military facts use approved mappings and occupation reference, not general web search.",
    };
  }

  if (/\b(o\*net|onet|occupation title|skill taxonomy)\b/.test(text)) {
    return {
      kind: "REFERENCE_LOOKUP",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: "onet",
      reason: "Occupation/skills questions use the O*NET reference layer.",
    };
  }

  if (
    /\b(typical wage|median wage|bls|labor[- ]market|employment projection|occupational wage)\b/.test(text) ||
    /\bwage for this occupation\b/.test(text)
  ) {
    return {
      kind: "STRUCTURED_EXTERNAL_LOOKUP",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: "bls",
      reason: "Quantitative labor-market questions prefer BLS/Census over web articles.",
    };
  }

  if (/\b(labor[- ]shed|commuting|lodes|lehd|workforce concentration)\b/.test(text)) {
    return {
      kind: "STRUCTURED_EXTERNAL_LOOKUP",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: "census",
      reason: "Geographic workforce intelligence uses Census/LEHD/LODES.",
    };
  }

  if (
    /\b(enrich|firmographic|buyer|apollo)\b/.test(text) ||
    (/\bresearch (this|the) company\b/.test(text) && !/\bhiring\b/.test(text))
  ) {
    return {
      kind: "HYBRID_RESEARCH",
      allowWeb: true,
      preferWebProvider: "openai",
      structuredDomain: "apollo",
      reason: "Company research uses CRM, then Apollo, then web.",
    };
  }

  if (/\bfind external candidates\b/.test(text) || /\bsourcing (for|this) (job|role)\b/.test(text)) {
    return {
      kind: "STRUCTURED_EXTERNAL_LOOKUP",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: "talent_sourcing",
      reason: "External candidate sourcing uses Talent Network first, then SeekOut/hireEZ.",
    };
  }

  if (isInternalTalentOrQueue(text) && !/\bcurrently hiring\b/.test(text) && !/\bcompanies\b/.test(text)) {
    return {
      kind: "INTERNAL_SEARCH",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: null,
      reason: "Answerable from WorkforceOS database.",
    };
  }

  if (/\bsummarize\b/.test(text) && !/\bnews\b/.test(text) && !/\bcurrently\b/.test(text)) {
    return {
      kind: "INTERNAL_SUMMARY",
      allowWeb: false,
      preferWebProvider: null,
      structuredDomain: null,
      reason: "Summaries of stored records stay internal.",
    };
  }

  if (
    /\bdeeper scan\b/.test(text) ||
    /\bexpanding in\b/.test(text) ||
    /\bbroad (employer|company) discovery\b/.test(text) ||
    /\bmanufacturers expanding\b/.test(text)
  ) {
    return {
      kind: "DEEP_WEB_RESEARCH",
      allowWeb: true,
      preferWebProvider: "tavily",
      structuredDomain: null,
      reason: "Deeper multi-result research can use Tavily.",
    };
  }

  if (
    (/\bcompanies\b/.test(text) && /\bour candidates\b/.test(text)) ||
    (/\bhiring\b/.test(text) && /\bcandidates who could fit\b/.test(text))
  ) {
    return {
      kind: "HYBRID_RESEARCH",
      allowWeb: true,
      preferWebProvider: "openai",
      structuredDomain: null,
      reason: "Hybrid: external hiring context plus internal Talent Network.",
    };
  }

  if (
    /\bcurrently hiring\b/.test(text) ||
    /\bhiring (electrical|for)\b/.test(text) ||
    /\brecent (news|hiring)\b/.test(text) ||
    /\bwhat companies\b/.test(text)
  ) {
    return {
      kind: "WEB_SEARCH",
      allowWeb: true,
      preferWebProvider: "openai",
      structuredDomain: null,
      reason: "Current general web information uses OpenAI web search.",
    };
  }

  if (/\bresearch this company\b/.test(text) || /\bbefore my meeting\b/.test(text)) {
    return {
      kind: "HYBRID_RESEARCH",
      allowWeb: true,
      preferWebProvider: "openai",
      structuredDomain: "apollo",
      reason: "Meeting prep uses CRM, Apollo, and web where needed.",
    };
  }

  return {
    kind: "INTERNAL_SEARCH",
    allowWeb: false,
    preferWebProvider: null,
    structuredDomain: null,
    reason: "Scout is internal-first unless the prompt clearly needs external intelligence.",
  };
}

export function shouldInvokeWebSearch(route: ScoutSourceRoute) {
  return route.allowWeb && (route.kind === "WEB_SEARCH" || route.kind === "DEEP_WEB_RESEARCH" || route.kind === "HYBRID_RESEARCH");
}
