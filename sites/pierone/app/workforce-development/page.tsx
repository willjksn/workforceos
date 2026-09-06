import type { Metadata } from "next";

import { BrandImage } from "@/components/media/brand-image";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "Workforce Development",
  description: "Workforce pipeline strategy: demand, supply, critical roles, skills gaps, and military overlay.",
};

export default function WorkforceDevelopmentPage() {
  return (
    <main>
      <Section tone="navy">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="text-[#9fc0cb]">Workforce development</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Pipeline strategy for the roles that matter most.
              </h1>
              <p className="mt-6 text-[17px] leading-8 text-white/80">
                Public workforce-development language on this site describes PierOne&apos;s Workforce Pipeline Assessment
                and related advisory work. It is not a separate unlisted product.
              </p>
            </div>
            <BrandImage image={IMAGES.workforce} overlay sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <Heading>Tied to Workforce Pipeline Assessment</Heading>
          <ul className="mt-8 grid gap-px border border-border bg-border md:grid-cols-2">
            {[
              "Critical-role analysis",
              "Workforce supply and demand",
              "Skills gaps",
              "Career pathways",
              "Military pipelines",
              "Training and education strategies",
              "Regional workforce intelligence",
              "Pipeline design",
            ].map((item) => (
              <li key={item} className="bg-white px-5 py-4 text-sm text-navy">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <CtaLink href="/services/workforce-pipeline-assessment">Workforce Pipeline Assessment</CtaLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
