import type { Metadata } from "next";

import { InquiryForm } from "@/components/forms/inquiry-form";
import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Military Talent",
  description:
    "Join the PierOne Military Talent Network, or work with PierOne to match transitioning service members to employer and SkillBridge-eligible opportunities. Placement is not guaranteed.",
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
              Connecting transitioning service members with civilian employers.
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-8 text-white/80">
              PierOne is the intermediary. We help translate military experience, identify potential employer matches,
              and connect transitioning talent with civilian and SkillBridge-eligible opportunities. We are not
              automatically the SkillBridge host, and joining does not guarantee a placement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/military-talent/join" variant="inverse">
                Join the Military Talent Network
              </CtaLink>
              <CtaLink href="/skillbridge" variant="ghostOnNavy">
                Explore SkillBridge-Eligible Opportunities
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
          <div className="grid gap-12 lg:grid-cols-2">
            <article>
              <Eyebrow>For transitioning service members</Eyebrow>
              <Heading>Build Your Transition Profile.</Heading>
              <p className="mt-4 text-[16px] leading-7 text-muted">
                Build your Transition Talent Profile and connect with civilian opportunities aligned to your
                experience, goals, timing, and location. You do not need a specific job opening to join the network.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-muted">
                <li>Military occupation, rank, leadership, training, and certifications</li>
                <li>Installation, separation date, and SkillBridge eligibility/window when applicable</li>
                <li>Geographic preferences and target civilian roles and industries</li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaLink href="/military-talent/join">Build Your Transition Profile</CtaLink>
                <CtaLink href="/careers" variant="secondary">
                  Explore Military Talent Opportunities
                </CtaLink>
              </div>
            </article>
            <article>
              <Eyebrow>For employers</Eyebrow>
              <Heading>Find military talent. Build a pipeline.</Heading>
              <p className="mt-4 text-[16px] leading-7 text-muted">
                PierOne helps employers see military occupations, skills, geography, and transition timing against real
                workforce demand. SkillBridge is one possible pathway when a host company, timing, and approval
                requirements align.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-muted">
                <li>Occupation translation and installation geography</li>
                <li>Employer opportunity design, including SkillBridge-eligible host roles</li>
                <li>Matching, introductions, interview support, placement, and conversion tracking</li>
              </ul>
              <div className="mt-8">
                <CtaLink href="/contact" variant="secondary">
                  Find Military Talent
                </CtaLink>
              </div>
            </article>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {[
              ["Why military talent", "Many technical and leadership skills developed in uniform transfer to civilian operations when they are translated carefully."],
              ["Occupation translation", "Army MOS, Navy Rating, Air Force AFSC, Marine MOS, Coast Guard Rating, and applicable Space Force classifications can be mapped to civilian work."],
              ["Civilian skill alignment", "Translation includes skills, likely gaps, and bridge considerations rather than title matching alone."],
              ["Installation and geography", "Talent markets often sit near installations. Mapping that geography is part of a serious military hiring plan."],
              ["SkillBridge-eligible opportunities", "SkillBridge can be relevant where a host employer, timing, and approval requirements align. PierOne facilitates matching; the employer/host company owns the opportunity. Approval is never guaranteed."],
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
              <p className="mt-3 text-muted">Employer inquiry for military talent strategy, matching, and pipeline design.</p>
            </div>
            <InquiryForm defaultService="military-talent-opportunity-assessment" pagePath="/military-talent" />
          </div>
        </Container>
      </Section>
    </main>
  );
}
