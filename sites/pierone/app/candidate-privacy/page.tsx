import type { Metadata } from "next";

import { Container, Heading, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Candidate Privacy Notice" };

export default function CandidatePrivacyPage() {
  return (
    <Section>
      <Container>
        <p className="text-xs uppercase tracking-[0.18em] text-teal">Legal placeholder — counsel review required</p>
        <Heading>Candidate Privacy Notice</Heading>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          This notice is a placeholder for counsel. Applications and Military Talent Network submissions create or update
          a Candidate record in WorkforceOS. Resumes are stored in private object storage. Public pages do not display
          candidate contact information. This is not final legal language.
        </p>
      </Container>
    </Section>
  );
}
