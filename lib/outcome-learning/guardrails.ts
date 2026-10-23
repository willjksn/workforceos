/**
 * Learning copy and queries must not produce an adverse action or read a protected trait.
 * Military status is allowed only as the aggregate program bucket in the outcome query.
 */

export const FORBIDDEN_LEARNING_COLUMNS = [
  "race",
  "ethnicity",
  "religion",
  "sex",
  "gender",
  "sexual_orientation",
  "sexual orientation",
  "age",
  "disability",
  "medical",
  "family_status",
  "political",
  "email",
  "phone",
  "compensation",
] as const;

const BANNED_COPY = [
  /reject candidates/i,
  /stop showing/i,
  /performs poorly/i,
  /should be excluded/i,
  /suppress candidates/i,
  /exclude candidates/i,
  /disadvantage/i,
];

export function advisoryTextAllowed(text: string) {
  return !BANNED_COPY.some((pattern) => pattern.test(text));
}

export function assertAdvisory(text: string) {
  if (!advisoryTextAllowed(text)) {
    throw new Error("Outcome learning copy violated an adverse-action guardrail.");
  }
}
