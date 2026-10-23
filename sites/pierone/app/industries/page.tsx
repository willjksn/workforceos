import type { Metadata } from "next";

import { IndustryGrid } from "@/components/industries/industry-grid";
import { Container, CtaLink, Heading, PageHero, Section } from "@/components/ui";
import { INDUSTRY_SUMMARIES } from "@/lib/content";
import { INDUSTRY_TILES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Industries",
  description: "Industry emphasis for Pier 24 Partners workforce and talent work. Listed industries are focus areas, not a client roster.",
};

export default function IndustriesPage() {
  return (
    <main>
      <PageHero eyebrow="Industries" title="Where workforce constraints show up clearly." size="narrow">
        <p className="mt-4 text-[17px] leading-8 text-white/80">
          These are emphasis areas, not a claim that Pier 24 Partners currently serves named clients in each industry.
        </p>
      </PageHero>
      <Section>
        <Container>
          <Heading>Primary emphasis</Heading>
          <IndustryGrid
            tiles={INDUSTRY_TILES.filter((tile) => tile.emphasis === "primary")}
            summaries={INDUSTRY_SUMMARIES}
          />
          <Heading className="mt-14">Secondary emphasis</Heading>
          <IndustryGrid
            tiles={INDUSTRY_TILES.filter((tile) => tile.emphasis === "secondary")}
            summaries={INDUSTRY_SUMMARIES}
          />
          <div className="mt-10">
            <CtaLink href="/contact">Work With Pier 24 Partners</CtaLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
