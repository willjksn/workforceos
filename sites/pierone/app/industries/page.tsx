import type { Metadata } from "next";

import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Heading, PageHero, Section } from "@/components/ui";
import { INDUSTRY_TILES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Industries",
  description: "Industry emphasis for PierOne workforce and talent work. Listed industries are focus areas, not a client roster.",
};

export default function IndustriesPage() {
  return (
    <main>
      <PageHero eyebrow="Industries" title="Where workforce constraints show up clearly." size="narrow">
        <p className="mt-4 text-[17px] leading-8 text-white/80">
          These are emphasis areas, not a claim that PierOne currently serves named clients in each industry.
        </p>
      </PageHero>
      <Section>
        <Container>
          <Heading>Primary emphasis</Heading>
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {INDUSTRY_TILES.filter((tile) => tile.emphasis === "primary").map((tile) => (
              <li key={tile.name} className="overflow-hidden rounded-[6px] border border-border bg-white">
                <BrandImage image={tile.image} overlay radius={false} sizes="(min-width: 768px) 40vw, 100vw" />
                <div className="px-5 py-4 font-serif text-xl text-navy">{tile.name}</div>
              </li>
            ))}
          </ul>
          <Heading className="mt-14">Secondary emphasis</Heading>
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {INDUSTRY_TILES.filter((tile) => tile.emphasis === "secondary").map((tile) => (
              <li key={tile.name} className="overflow-hidden rounded-[6px] border border-border bg-white">
                <BrandImage image={tile.image} overlay radius={false} sizes="(min-width: 768px) 40vw, 100vw" />
                <div className="px-5 py-4 text-navy">{tile.name}</div>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <CtaLink href="/contact">Work With PierOne</CtaLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
