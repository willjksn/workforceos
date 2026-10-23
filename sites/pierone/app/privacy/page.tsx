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
          This page is a structural placeholder. It is not final legal language. Pier 24 Partners is the public brand
          on this page and is not a statement of the legal entity name. The site collects business inquiry and career
          application information to operate workforce and talent services. Candidate information is treated as
          Restricted PII inside WorkforceOS. Counsel must approve any final privacy policy.
        </p>
      </Container>
    </Section>
  );
}
