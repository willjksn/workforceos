import type { Metadata } from "next";

import { Container, Heading, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <Section>
      <Container>
        <p className="text-xs uppercase tracking-[0.18em] text-teal">Legal placeholder — counsel review required</p>
        <Heading>Privacy Policy</Heading>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          This page is a structural placeholder. It is not final legal language. PierOne Partners collects business
          inquiry and career application information to operate its workforce and talent services. Candidate information
          is treated as Restricted PII inside WorkforceOS. Do not treat this text as an approved privacy policy.
        </p>
      </Container>
    </Section>
  );
}
