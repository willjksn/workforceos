import type { Metadata } from "next";
import Link from "next/link";

import { FeaturedJobStrip, SiteAnnouncement } from "@/components/content/public-content";
import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { workforceOsPublic } from "@/lib/workforceos/client";

export const metadata: Metadata = {
  title: "SkillBridge",
  description: "PierOne helps connect transitioning service members with relevant opportunities. Placement and SkillBridge approval are not guaranteed.",
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
              <Eyebrow className="text-[#9fc0cb]">SkillBridge</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Transition with a clearer civilian picture.
              </h1>
              <p className="mt-6 text-[17px] leading-8 text-white/80">
                PierOne helps connect transitioning service members with relevant opportunities and helps employers
                understand where SkillBridge may fit. Opportunities depend on employer needs and approval requirements.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="/careers" variant="inverse">
                  Explore SkillBridge Opportunities
                </CtaLink>
                <CtaLink href="/skillbridge/join" variant="ghostOnNavy">
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
          <FeaturedJobStrip jobs={content.featuredSkillBridge} heading="Featured SkillBridge roles" />
          <Heading>What this is — and is not</Heading>
          <ul className="mt-6 max-w-3xl space-y-4 text-[16px] leading-7 text-muted">
            <li>Military experience can be translated into civilian roles. Translation is not automatic placement.</li>
            <li>SkillBridge internships and related opportunities depend on an employer and on service/command approval.</li>
            <li>PierOne does not guarantee placement, employment, SkillBridge approval, or conversion to a civilian job.</li>
          </ul>
          <p className="mt-8 text-sm text-muted">
            Employers: see <Link className="text-navy underline" href="/military-talent">Military Talent</Link> for the
            opportunity-assessment offering.
          </p>
        </Container>
      </Section>
    </main>
  );
}
