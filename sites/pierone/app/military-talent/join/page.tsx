import type { Metadata } from "next";

import { MilitaryJoinForm } from "@/components/forms/military-join-form";
import { Container, PageHero, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Join the Military Talent Network",
  description:
    "Build your Transition Talent Profile and connect with civilian opportunities aligned to your experience, goals, timing, and location. Placement is not guaranteed.",
};

export default function MilitaryTalentJoinPage() {
  return (
    <main>
      <PageHero eyebrow="Military Talent Network" title="Build Your Transition Profile" size="narrow">
        <p className="mt-4 text-[17px] leading-8 text-white/80">
          Join the PierOne Military Talent Network. PierOne helps translate your military experience, identify potential
          employer matches, and connect you with civilian and SkillBridge-eligible opportunities. You do not need a
          specific job opening to join. This is not an application to a PierOne SkillBridge program, and it does not
          guarantee matching, SkillBridge approval, or employment.
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
