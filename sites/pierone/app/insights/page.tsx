import type { Metadata } from "next";

import { Container, Heading, PageHero, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Insights",
  description: "PierOne insights. Articles will be published here when approved.",
};

export default function InsightsPage() {
  return (
    <main>
      <PageHero eyebrow="Insights" title="Thinking on workforce, talent, and military translation." size="narrow" />
      <Section>
        <Container size="narrow">
          <Heading>Coming soon</Heading>
          <p className="mt-4 text-muted">
            No public articles are approved in the repository yet. This page is ready for curated pieces. Sample
            development content is not published as if it were research.
          </p>
        </Container>
      </Section>
    </main>
  );
}
