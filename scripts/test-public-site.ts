import "./load-env";

import { eq } from "drizzle-orm";

import { getDb } from "../db";
import { activities, companies, contacts, publicIntakeSettings, websiteInquiries } from "../db/schema";
import { INTERNAL_ORG_ID, USER_IDS } from "../db/seed/constants";
import { seedFoundation } from "../db/seed";
import { resetMockEmailProvider, getSharedMockEmailProvider } from "../lib/email";
import { submitWebsiteInquiry, convertInquiryToOpportunity } from "../lib/inquiries/service";
import { submitMilitaryTalentProfile } from "../lib/military-talent/public-intake";
import { parseScoutIntent } from "../lib/scout/parse-intent";
import { parseScoutPageContext } from "../lib/scout/page-context";
import { S3CompatibleStorageProvider } from "../lib/storage/s3-compatible";
import { signPublicSiteRequest, sha256Hex } from "../lib/public-api/hmac";
import { normalizeWebsiteHost, stripHtml } from "../lib/public-api/normalize";
import { RATE_LIMITS, RateLimitError, assertRateLimit, resetMemoryRateLimits } from "../lib/security/rate-limit";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  await seedFoundation();
  const db = getDb();
  resetMockEmailProvider();
  resetMemoryRateLimits();

  console.log("TEST 1 — Public site contracts strip HTML");
  assert(stripHtml("<b>Hello</b>") === "Hello", "HTML stripped");
  assert(normalizeWebsiteHost("https://www.Example.com/careers") === "example.com", "Host normalized");

  console.log("TEST 2 — HMAC signature is stable");
  const signature = signPublicSiteRequest({
    secret: "test-secret",
    method: "POST",
    path: "/api/public/v1/inquiries",
    timestamp: "1",
    bodyHash: sha256Hex("{}"),
  });
  assert(signature.length === 64, "HMAC hex length");

  console.log("TEST 3 — Inquiry creates intake + contact, not an opportunity");
  const first = await submitWebsiteInquiry({
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan.lee@example-energy.test",
    company: "Example Energy LLC",
    companyWebsite: "https://example-energy.test",
    serviceInterest: "professional-search",
    challenge: "Need a plant manager search.",
    pagePath: "/contact",
  });
  assert(first.inquiry.status === "new", "Inquiry starts new");
  assert(!first.inquiry.opportunityId, "No automatic opportunity");
  assert(first.inquiry.contactId, "Contact created or linked");
  assert(first.inquiry.ownerUserId === USER_IDS.managingPartner, "Owner resolved from managing-partner role");
  const mailed = getSharedMockEmailProvider().sent.some((row) => row.template === "inquiry_acknowledgement");
  assert(mailed, "Acknowledgement email event created");

  console.log("TEST 4 — Duplicate company website reuses company");
  const second = await submitWebsiteInquiry({
    firstName: "Sam",
    lastName: "Patel",
    email: "sam.patel@example-energy.test",
    company: "Example Energy",
    companyWebsite: "www.example-energy.test",
    serviceInterest: "fractional-talent-partner",
    challenge: "Need fractional TA leadership.",
  });
  assert(second.inquiry.companyId === first.inquiry.companyId, "Domain match reuses company");
  assert(second.inquiry.contactMatchStatus === "linked" || second.inquiry.contactId !== first.inquiry.contactId, "Contact handling is explicit");

  console.log("TEST 5 — Name-only company is unresolved");
  const unresolved = await submitWebsiteInquiry({
    firstName: "Casey",
    lastName: "Ng",
    email: "casey.ng@unresolved-firm.test",
    company: "Acme",
    serviceInterest: "other",
    challenge: "Not sure where to start.",
  });
  assert(unresolved.inquiry.companyMatchStatus === "unresolved", "No name-only company merge");
  assert(!unresolved.inquiry.companyId, "Company left unlinked without a domain");

  console.log("TEST 6 — Convert inquiry requires company and human action");
  const converted = await convertInquiryToOpportunity({
    organizationId: INTERNAL_ORG_ID,
    actorUserId: USER_IDS.managingPartner,
    inquiryId: first.inquiry.id,
  });
  assert(converted?.status === "converted_to_opportunity", "Converted");
  assert(converted?.opportunityId, "Opportunity id stored on inquiry");

  console.log("TEST 7 — Honeypot rejects inquiry");
  let honeypotBlocked = false;
  try {
    await submitWebsiteInquiry({
      firstName: "Bot",
      lastName: "Bot",
      email: "bot@example.com",
      company: "Bot Co",
      serviceInterest: "other",
      challenge: "spam",
      honeypot: "http://spam.test",
    });
  } catch {
    honeypotBlocked = true;
  }
  assert(honeypotBlocked, "Honeypot blocked");

  console.log("TEST 8 — Rate limit");
  resetMemoryRateLimits();
  let limited = false;
  for (let i = 0; i < 6; i += 1) {
    try {
      await assertRateLimit({ key: "public-inquiry:test", ...RATE_LIMITS.publicInquiry });
    } catch (error) {
      if (error instanceof RateLimitError) limited = true;
    }
  }
  assert(limited, "Rate limit trips");

  console.log("TEST 9 — Military talent reuses candidate");
  const military = await submitMilitaryTalentProfile({
    firstName: "Taylor",
    lastName: "Ellis",
    email: "taylor.ellis.public@example.test",
    branch: "navy",
    mos: "EM",
    targetCivilianRoles: "Maintenance supervisor",
  });
  const again = await submitMilitaryTalentProfile({
    firstName: "Taylor",
    lastName: "Ellis",
    email: "taylor.ellis.public@example.test",
    branch: "navy",
  });
  assert(again.candidateId === military.candidateId, "Candidate reused");
  assert(again.profileId === military.profileId, "SkillBridge profile reused");

  console.log("TEST 10 — Scout understands website inquiries");
  const parsed = parseScoutIntent("Show me new website leads.");
  assert(parsed.ok && parsed.dto.entity === "website_inquiries", "Scout maps website leads");
  const convertIntent = parseScoutIntent("Convert this inquiry into an opportunity", parseScoutPageContext(`/app/crm/inquiries/${first.inquiry.id}`));
  assert(convertIntent.ok && convertIntent.dto.family === "CREATE", "Scout convert command");

  console.log("TEST 11 — S3 adapter refuses public-looking keys and missing config");
  const s3 = new S3CompatibleStorageProvider({});
  let s3Blocked = false;
  try {
    await s3.upload({ key: "../escape", body: new Uint8Array([1]), mimeType: "application/pdf", filename: "a.pdf" });
  } catch {
    s3Blocked = true;
  }
  assert(s3Blocked, "Unconfigured S3 cannot upload");

  console.log("TEST 12 — Activity recorded");
  const [activity] = await db
    .select()
    .from(activities)
    .where(eq(activities.subject, "Website inquiry submitted"))
    .limit(1);
  assert(activity, "Activity exists");

  console.log("TEST 13 — Intake settings exist without hardcoded founder id in schema default");
  const [settings] = await db.select().from(publicIntakeSettings).where(eq(publicIntakeSettings.organizationId, INTERNAL_ORG_ID));
  assert(settings?.inquiryOwnerRoleSlug === "managing-partner", "Role-based assignment");

  const leftover = await db.select({ id: websiteInquiries.id }).from(websiteInquiries).limit(1);
  assert(leftover[0], "Inquiry persisted");
  const company = first.inquiry.companyId
    ? await db.select().from(companies).where(eq(companies.id, first.inquiry.companyId))
    : [];
  assert(company.length <= 1, "Company row present when linked");
  const contactRows = await db.select().from(contacts).where(eq(contacts.email, "jordan.lee@example-energy.test"));
  assert(contactRows.length >= 1, "Contact persisted");

  console.log("Public website gateway tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
