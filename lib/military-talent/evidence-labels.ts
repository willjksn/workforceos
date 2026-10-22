const SOURCE_LABELS: Record<string, string> = {
  resume: "Resume extracted",
  candidate: "Candidate reported",
  recruiter: "Recruiter entered",
  ai_extraction: "AI extraction",
  military_occupation_mapping: "Occupation mapping",
};

export function evidenceReviewLabel(input: { source: string; humanVerified: boolean }) {
  const origin = SOURCE_LABELS[input.source] ?? "Recorded";
  if (input.humanVerified) return `Human reviewed (${origin} origin)`;
  if (input.source === "resume" || input.source === "ai_extraction") return `${origin}, pending review`;
  if (input.source === "candidate") return "Candidate reported";
  if (input.source === "recruiter") return "Recruiter entered, pending review";
  return `${origin}, pending review`;
}
