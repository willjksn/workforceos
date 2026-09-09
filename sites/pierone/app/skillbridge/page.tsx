import type { Metadata } from "next";
import Link from "next/link";

import { FeaturedJobStrip, SiteAnnouncement } from "@/components/content/public-content";
import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { workforceOsPublic } from "@/lib/workforceos/client";

export const metadata: Metadata = {
  title: "SkillBridge-Eligible Opportunities",
  description:
    "Explore employer and host-company SkillBridge-eligible opportunities facilitated by PierOne. PierOne is the intermediary, not automatically the SkillBridge host. Placement is not guaranteed.",
};

export const revalidate = 60;

export default async function SkillBridgePage() {
  const content = await workforceOsPublic.getContent();
  return (
    <main>
      <SiteAnnouncement announcements={content.announcements} placement="skillbridge" />
      <Section tone="navy">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="text-[#9fc0cb]">SkillBridge-eligible opportunities</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                A military-to-civilian pathway — when a host employer fits.
              </h1>
              <p className="mt-6 text-[17px] leading-8 text-white/80">
                SkillBridge is one possible transition pathway. Featured roles are employer or host-company
                opportunities that PierOne surfaces. PierOne is generally not the SkillBridge host. Opportunities depend
                on employer needs and service/command approval.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="/careers" variant="inverse">
                  Explore SkillBridge-Eligible Opportunities
                </CtaLink>
                <CtaLink href="/military-talent/join" variant="ghostOnNavy">
                  Join the Military Talent Network
                </CtaLink>
              </div>
            </div>
            <BrandImage image={IMAGES.skillbridge} overlay sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <FeaturedJobStrip
            jobs={content.featuredSkillBridge}
            heading="Featured SkillBridge-Eligible Opportunities"
            intro="These are employer or host-company SkillBridge-eligible opportunities facilitated by PierOne, not PierOne-owned SkillBridge slots."
          />
          <Heading>What this is — and is not</Heading>
          <ul className="mt-6 max-w-3xl space-y-4 text-[16px] leading-7 text-muted">
            <li>PierOne finds transitioning service members, builds transition talent profiles, and matches them to employer opportunities.</li>
            <li>SkillBridge internships and related opportunities depend on a host company/employer and on service/command approval.</li>
            <li>Joining the Military Talent Network does not enroll you in a PierOne SkillBridge program or guarantee a placement.</li>
            <li>PierOne does not guarantee placement, employment, SkillBridge approval, or conversion to a civilian job.</li>
          </ul>
          <p className="mt-8 text-sm text-muted">
            Transitioning service members:{" "}
            <Link className="text-navy underline" href="/military-talent/join">
              join the Military Talent Network
            </Link>
            . Employers: see <Link className="text-navy underline" href="/military-talent">Military Talent</Link> to
            build a military talent pipeline.
          </p>
        </Container>
      </Section>
    </main>
  );
}
