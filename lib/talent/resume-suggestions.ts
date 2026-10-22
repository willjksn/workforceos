const SECTION_HEADERS =
  /^(skills|technical skills|core competencies|competencies|experience|work experience|professional experience|employment history|work history|education|certifications|certificates|summary|professional summary|objective|projects|awards|clearance)$/i;

const DEGREE =
  /^(bachelor(?:'s)?(?: of [a-z]+)?|master(?:'s)?(?: of [a-z]+)?|associate(?:'s)?(?: of [a-z]+)?|doctor(?:ate)? of [a-z]+|ph\.?d\.?|m\.?b\.?a\.?|b\.s\.?|b\.a\.?|m\.s\.?|m\.a\.?|a\.s\.?|a\.a\.?)\b/i;

export type PlannedEducation = {
  institution: string;
  degreeOrCredential: string;
  fieldOfStudy: string | null;
  source: "resume";
  humanVerified: false;
  confidence: 40;
};

export type PlannedCredential = {
  name: string;
  source: "resume";
  humanVerified: false;
  confidence: 40;
};

export type PlannedClearance = {
  clearanceLevel: "confidential" | "secret" | "top_secret" | "ts_sci";
  clearanceStatus: "unknown";
  source: "resume";
  humanVerified: false;
};

function linesOf(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^[•\-\u2022]+\s*/, "").trim())
    .filter(Boolean);
}

function sectionBody(lines: string[], names: string[]) {
  const start = lines.findIndex((line) => names.includes(line.toLowerCase().replace(/:$/, "")));
  if (start < 0) return [];
  const body: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (SECTION_HEADERS.test(lines[index].replace(/:$/, ""))) break;
    body.push(lines[index]);
  }
  return body;
}

function parseEducationLine(line: string): Omit<PlannedEducation, "source" | "humanVerified" | "confidence"> | null {
  const inForm = line.match(/^(.+?)\s+in\s+(.+?),\s+(.+)$/i);
  if (inForm && DEGREE.test(inForm[1].trim())) {
    return {
      degreeOrCredential: inForm[1].trim(),
      fieldOfStudy: inForm[2].trim(),
      institution: inForm[3].trim(),
    };
  }
  const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3 && DEGREE.test(parts[0])) {
    return {
      degreeOrCredential: parts[0],
      fieldOfStudy: parts[1],
      institution: parts.slice(2).join(", "),
    };
  }
  if (parts.length === 2 && DEGREE.test(parts[0]) && parts[1].length > 2) {
    return { degreeOrCredential: parts[0], fieldOfStudy: null, institution: parts[1] };
  }
  return null;
}

function explicitClearance(text: string): PlannedClearance["clearanceLevel"] | null {
  const pattern =
    /\b(?:clearance\s*[:\-]?\s*)?(TS\/SCI|TS-SCI|Top Secret\/SCI|Top Secret|Secret|Confidential)\s+clearance\b/gi;
  const levels = new Set<PlannedClearance["clearanceLevel"]>();
  for (const match of text.matchAll(pattern)) {
    const phrase = match[1] ?? "";
    if (/ts[/-]sci|top secret\/sci/i.test(phrase)) levels.add("ts_sci");
    else if (/top secret/i.test(phrase)) levels.add("top_secret");
    else if (/^secret$/i.test(phrase)) levels.add("secret");
    else if (/^confidential$/i.test(phrase)) levels.add("confidential");
  }
  if (levels.size !== 1) return null;
  return [...levels][0] ?? null;
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function emptyFieldFill(current: string | null | undefined, incoming: string | null | undefined) {
  if (current != null && current.trim() !== "") return undefined;
  if (incoming == null || incoming.trim() === "") return undefined;
  return incoming.trim();
}

export function planResumeEvidenceSuggestions(input: {
  text: string;
  existingEducation: Array<{ institution: string; degreeOrCredential: string; humanVerified: boolean }>;
  existingCredentials: Array<{ name: string; humanVerified: boolean }>;
  existingClearance: { clearanceLevel: string; humanVerified: boolean } | null;
}) {
  const lines = linesOf(input.text);
  const education: PlannedEducation[] = [];
  const seenEducation = new Set<string>();
  for (const line of sectionBody(lines, ["education"])) {
    const parsed = parseEducationLine(line);
    if (!parsed) continue;
    const key = `${parsed.institution}|${parsed.degreeOrCredential}`.toLowerCase();
    if (seenEducation.has(key)) continue;
    seenEducation.add(key);
    const existing = input.existingEducation.find(
      (row) => sameText(row.institution, parsed.institution) && sameText(row.degreeOrCredential, parsed.degreeOrCredential),
    );
    if (existing) continue;
    education.push({ ...parsed, source: "resume", humanVerified: false, confidence: 40 });
  }

  const credentials: PlannedCredential[] = [];
  const seenCredentials = new Set<string>();
  for (const line of sectionBody(lines, ["certifications", "certificates"])) {
    if (line.length < 3 || line.length > 120) continue;
    if (/\bclearance\b/i.test(line)) continue;
    if ((line.match(/\./g) ?? []).length > 1) continue;
    const name = line.replace(/\.$/, "").trim();
    const key = name.toLowerCase();
    if (seenCredentials.has(key)) continue;
    seenCredentials.add(key);
    if (input.existingCredentials.some((row) => sameText(row.name, name))) continue;
    credentials.push({ name, source: "resume", humanVerified: false, confidence: 40 });
  }

  const preservedHumanReviewed: string[] = [];
  for (const row of input.existingEducation) {
    if (!row.humanVerified) continue;
    const mentioned = sectionBody(lines, ["education"]).some((line) => {
      const parsed = parseEducationLine(line);
      return parsed
        ? sameText(parsed.institution, row.institution) && sameText(parsed.degreeOrCredential, row.degreeOrCredential)
        : false;
    });
    if (mentioned) preservedHumanReviewed.push(`education:${row.institution}`);
  }
  for (const row of input.existingCredentials) {
    if (!row.humanVerified) continue;
    const mentioned = sectionBody(lines, ["certifications", "certificates"]).some((line) => sameText(line.replace(/\.$/, ""), row.name));
    if (mentioned) preservedHumanReviewed.push(`credential:${row.name}`);
  }

  let clearance: PlannedClearance | null = null;
  const parsedLevel = explicitClearance(input.text);
  if (parsedLevel) {
    if (input.existingClearance?.humanVerified) {
      preservedHumanReviewed.push("clearance");
    } else if (!input.existingClearance) {
      clearance = {
        clearanceLevel: parsedLevel,
        clearanceStatus: "unknown",
        source: "resume",
        humanVerified: false,
      };
    }
  }

  return { education, credentials, clearance, preservedHumanReviewed };
}
