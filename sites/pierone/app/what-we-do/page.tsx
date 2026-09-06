import type { Metadata } from "next";
import Link from "next/link";

import { SERVICES } from "@/lib/content";
import { Container, CtaLink, PageHero, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Solutions",
  description: "Five PierOne Partners solutions for hiring, military talent, talent acquisition performance, fractional talent leadership, and workforce pipelines.",
};

export default function WhatWeDoPage() {
  return (
    <main>
      <PageHero eyebrow="Solutions" title="Five solutions. One workforce practice." size="narrow">
        <p className="mt-6 text-[17px] leading-8 text-white/80">
          PierOne Partners is a workforce and talent solutions firm. These are the commercial offerings. Internal
          recruiting, SkillBridge operations, and workforce intelligence support the work; they are not five extra
          public products.
        </p>
      </PageHero>
      <Section>
        <Container>
          <ol className="divide-y divide-border border-y border-border">
            {SERVICES.map((service, index) => (
              <li key={service.slug}>
                <Link
                  href={`/services/${service.slug}`}
                  className="group grid gap-3 py-8 md:grid-cols-[4.5rem_1fr_auto] md:items-start"
                >
                  <span className="font-serif text-2xl text-teal">0{index + 1}</span>
                  <div>
                    <h2 className="font-serif text-3xl text-navy group-hover:text-teal">{service.name}</h2>
                    <p className="mt-3 max-w-3xl text-[16px] leading-7 text-muted">{service.problem}</p>
                  </div>
                  <span className="text-sm text-teal" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <CtaLink href="/contact">Work With PierOne</CtaLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
