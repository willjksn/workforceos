export type ParsedResumeExperience = {
  employer: string;
  title: string;
  summary: string | null;
};

export type ParsedResume = {
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  city: string | null;
  region: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  yearsExperience: number | null;
  careerInterests: string | null;
  experiences: ParsedResumeExperience[];
  skillNames: string[];
};

const SECTION_HEADERS = /^(skills|technical skills|core competencies|competencies|experience|work experience|professional experience|employment history|work history|education|certifications|certificates|summary|professional summary|objective|projects|awards)$/i;

function normalizeLines(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/^[•\-\u2022]+\s*/, "").trim())
    .filter(Boolean);
}

function firstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[1]?.trim() || match?.[0]?.trim() || null;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

function normalizeLinkedin(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function sectionBody(lines: string[], names: string[]) {
  const start = lines.findIndex((line) => names.includes(line.toLowerCase().replace(/:$/, "")));
  if (start < 0) return [];
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (SECTION_HEADERS.test(lines[i].replace(/:$/, ""))) break;
    body.push(lines[i]);
  }
  return body;
}

function parseLocation(text: string) {
  const match = text.match(/\b([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b/);
  if (!match) return { city: null, region: null };
  return { city: match[1].trim(), region: match[2] };
}

function isDateLine(line: string) {
  return /^\d{4}\s*[-–—]\s*(present|\d{4})$/i.test(line) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(line);
}

function parseExperiences(lines: string[]): ParsedResumeExperience[] {
  const body = sectionBody(lines, [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "work history",
  ]);
  const experiences: ParsedResumeExperience[] = [];
  let i = 0;
  while (i < body.length && experiences.length < 8) {
    while (i < body.length && isDateLine(body[i])) i += 1;
    const title = body[i++];
    while (i < body.length && isDateLine(body[i])) i += 1;
    const employer = body[i++];
    if (!title || !employer || SECTION_HEADERS.test(title) || SECTION_HEADERS.test(employer)) break;
    const summary: string[] = [];
    while (i < body.length && summary.length < 4) {
      if (isDateLine(body[i])) {
        i += 1;
        continue;
      }
      const maybeTitle = body[i];
      const maybeEmployer = body[i + 1];
      if (
        summary.length >= 1 &&
        maybeTitle &&
        maybeEmployer &&
        maybeTitle.length <= 70 &&
        maybeEmployer.length <= 70 &&
        !maybeTitle.includes(".")
      ) {
        break;
      }
      summary.push(body[i]);
      i += 1;
    }
    experiences.push({
      title: title.slice(0, 200),
      employer: employer.replace(/\s+\d{4}.*$/, "").slice(0, 200),
      summary: summary.join(" ").slice(0, 2000) || null,
    });
  }
  return experiences;
}

function parseSkills(lines: string[], fullText: string) {
  const body = sectionBody(lines, ["skills", "technical skills", "core competencies", "competencies"]);
  const fromSection = body
    .join(",")
    .split(/[,;/|•\u2022]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 60 && !SECTION_HEADERS.test(item));
  if (fromSection.length) return [...new Set(fromSection)].slice(0, 30);
  const fallback = fullText.match(/\b(electrical|plc|osha|navy|excel|leadership|troubleshooting|maintenance|safety)\b/gi) ?? [];
  return [...new Set(fallback.map((item) => item.trim()))].slice(0, 12);
}

export function parseResumeText(text: string): ParsedResume {
  const cleaned = text.replace(/\u0000/g, " ").trim();
  const lines = normalizeLines(cleaned);
  const email = firstMatch(cleaned, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.toLowerCase() ?? null;
  const rawPhone = firstMatch(cleaned, /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const linkedin = firstMatch(cleaned, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i);
  const { city, region } = parseLocation(cleaned);
  const experiences = parseExperiences(lines);
  const yearsMatch = cleaned.match(/\b(\d{1,2})\+?\s+years(?:\s+of\s+experience)?\b/i);
  const yearsExperience = yearsMatch ? Math.min(50, Number(yearsMatch[1])) : null;
  const skillNames = parseSkills(lines, cleaned);
  const headerLines = lines.filter((line) => !line.includes("@") && !/linkedin\.com/i.test(line) && !/\d{3}[-.\s]?\d{3}/.test(line)).slice(0, 6);
  const currentTitle = experiences[0]?.title ?? headerLines.find((line, index) => index > 0 && line.length <= 80 && !/,\s*[A-Z]{2}$/.test(line)) ?? null;
  const currentCompany = experiences[0]?.employer ?? null;
  return {
    email,
    phone,
    linkedinUrl: linkedin ? normalizeLinkedin(linkedin) : null,
    city,
    region,
    currentTitle,
    currentCompany,
    yearsExperience,
    careerInterests: skillNames.slice(0, 8).join(", ") || null,
    experiences,
    skillNames,
  };
}
