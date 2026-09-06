import type { Metadata } from "next";

import { MilitaryJoinForm } from "@/components/forms/military-join-form";
import { Container, PageHero, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Join the Military Talent Network",
  description: "Join PierOne's Military Talent Network without applying to a specific job.",
};

export default function SkillBridgeJoinPage() {
  return (
    <main>
      <PageHero eyebrow="Military Talent Network" title="Join without a specific job application" size="narrow">
        <p className="mt-4 text-[17px] leading-8 text-white/80">
          This profile enters PierOne&apos;s Talent Network. It does not guarantee matching, SkillBridge approval, or
          employment.
        </p>
      </PageHero>
      <Section>
        <Container>
          <div className="max-w-3xl">
            <MilitaryJoinForm />
          </div>
        </Container>
      </Section>
    </main>
  );
}
