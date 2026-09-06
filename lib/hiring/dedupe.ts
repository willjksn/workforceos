import { and, eq, isNull, or, sql } from "drizzle-orm";

import { getDb } from "../../db";
import { candidates } from "../../db/schema";

export function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits || null;
}

export type DedupeResult =
  | { kind: "new" }
  | { kind: "matched"; candidateId: string }
  | { kind: "ambiguous"; candidateIds: string[]; reason: string };

export async function matchExistingCandidate(input: {
  organizationId: string;
  email?: string | null;
  phone?: string | null;
}): Promise<DedupeResult> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) return { kind: "new" };

  const db = getDb();
  const conditions = [
    eq(candidates.organizationId, input.organizationId),
    isNull(candidates.archivedAt),
    isNull(candidates.privacyDeletedAt),
  ];
  const matchers = [];
  if (email) matchers.push(sql`lower(${candidates.email}) = ${email}`);
  if (phone) {
    matchers.push(
      sql`regexp_replace(coalesce(${candidates.phone}, ''), '[^0-9]', '', 'g') like ${"%" + phone}`,
    );
  }
  const rows = await db
    .select({ id: candidates.id, email: candidates.email, phone: candidates.phone })
    .from(candidates)
    .where(and(...conditions, or(...matchers)!));

  const emailHits = email
    ? rows.filter((row) => normalizeEmail(row.email) === email).map((row) => row.id)
    : [];
  const phoneHits = phone
    ? rows.filter((row) => normalizePhone(row.phone) === phone).map((row) => row.id)
    : [];
  const uniqueEmail = [...new Set(emailHits)];
  const uniquePhone = [...new Set(phoneHits)];

  if (uniqueEmail.length > 1 || uniquePhone.length > 1) {
    return {
      kind: "ambiguous",
      candidateIds: [...new Set([...uniqueEmail, ...uniquePhone])],
      reason: "Multiple records share this email or phone.",
    };
  }
  if (uniqueEmail.length === 1 && uniquePhone.length === 1 && uniqueEmail[0] !== uniquePhone[0]) {
    return {
      kind: "ambiguous",
      candidateIds: [uniqueEmail[0], uniquePhone[0]],
      reason: "Email and phone match different candidates.",
    };
  }
  if (uniqueEmail.length === 1) return { kind: "matched", candidateId: uniqueEmail[0] };
  if (uniquePhone.length === 1) return { kind: "matched", candidateId: uniquePhone[0] };
  return { kind: "new" };
}

export function looksLikeNameOnlyMatch() {
  return false;
}
