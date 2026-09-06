import type { Metadata } from "next";

import { Container, Heading, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Website Terms" };

export default function TermsPage() {
  return (
    <Section>
      <Container>
        <p className="text-xs uppercase tracking-[0.18em] text-teal">Legal placeholder — counsel review required</p>
        <Heading>Website Terms</Heading>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Structural placeholder only. Use of this website, inquiry forms, and career applications is subject to terms
          that counsel must approve before public launch.
        </p>
      </Container>
    </Section>
  );
}
