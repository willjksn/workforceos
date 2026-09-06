import type { Metadata } from "next";

import { InquiryForm } from "@/components/forms/inquiry-form";
import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Military Talent",
  description: "Employer-facing military talent strategy: occupation translation, installation mapping, SkillBridge strategy, and opportunity assessment.",
};

export default function MilitaryTalentPage() {
  return (
    <main>
      <Section tone="navy">
        <div className="mx-auto grid max-w-6xl items-center gap-0 lg:grid-cols-2">
          <div className="px-6 py-16 md:py-24 lg:pr-12">
            <Eyebrow className="text-[#9fc0cb]">Military talent</Eyebrow>
            <HorizonRule className="mt-5" />
            <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Where military talent fits civilian work.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-8 text-white/80">
              PierOne helps employers see military occupations, skills, geography, and transition pipelines against real
              workforce demand. This is strategy and search support, not a guarantee of SkillBridge approval or hire.
            </p>
            <div className="mt-8">
              <CtaLink href="/skillbridge" variant="inverse">
                View SkillBridge Opportunities
              </CtaLink>
            </div>
          </div>
          <div className="px-6 pb-12 lg:py-16">
            <BrandImage image={IMAGES.military} overlay sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </div>
      </Section>
      <Section>
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            {[
              ["Why military talent", "Many technical and leadership skills developed in uniform transfer to civilian operations when they are translated carefully."],
              ["Occupation translation", "Army MOS, Navy Rating, Air Force AFSC, Marine MOS, Coast Guard Rating, and applicable Space Force classifications can be mapped to civilian work."],
              ["Civilian skill alignment", "Translation includes skills, likely gaps, and bridge considerations rather than title matching alone."],
              ["Installation and geography", "Talent markets often sit near installations. Mapping that geography is part of a serious military hiring plan."],
              ["SkillBridge strategy", "SkillBridge can be relevant where employer needs, timing, and approval requirements align. Approval is never guaranteed."],
              ["Transition pipelines", "Separating and retiring service members move on known windows. Pipeline design uses those windows without promising conversion."],
            ].map(([title, body]) => (
              <article key={title} className="border-t border-border pt-6">
                <h2 className="font-serif text-2xl text-navy">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-16 grid gap-10 lg:grid-cols-2">
            <div>
              <Heading>Talk to PierOne</Heading>
              <p className="mt-3 text-muted">Employer inquiry for military talent solutions.</p>
            </div>
            <InquiryForm defaultService="military-talent-opportunity-assessment" pagePath="/military-talent" />
          </div>
        </Container>
      </Section>
    </main>
  );
}
