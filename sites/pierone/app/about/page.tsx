import type { Metadata } from "next";

import { BrandImage } from "@/components/media/brand-image";
import { Container, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = {
  title: "About",
  description: "PierOne Partners is a workforce and talent solutions firm. Team biographies are held for review.",
};

export default function AboutPage() {
  return (
    <main>
      <Section tone="navy">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="text-[#9fc0cb]">About</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Workforce expertise with operating discipline.
              </h1>
              <p className="mt-6 text-[17px] leading-8 text-white/80">
                PierOne Partners helps organizations solve immediate talent needs while building stronger future
                workforce pipelines. The work is advisory and search-oriented.
              </p>
            </div>
            <BrandImage image={IMAGES.about} overlay sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </Container>
      </Section>
      <Section>
        <Container size="narrow">
          <Heading>Philosophy</Heading>
          <p className="mt-4 text-[16px] leading-7 text-muted">
            Immediate hiring needs and future pipelines are the same problem on different clocks. PierOne connects
            search, military talent strategy, and workforce planning so those clocks are not treated as separate
            businesses. This is not high-volume temporary staffing, payroll, or a public job marketplace.
          </p>
          <Heading>Practice</Heading>
          <p className="mt-4 text-[16px] leading-7 text-muted">
            The practice covers professional and technical search, military talent translation, talent acquisition
            performance, fractional talent leadership, and workforce pipeline strategy. Military recruiting experience
            informs the military talent work; it is not a claim of guaranteed placements.
          </p>
          <Heading>Leadership</Heading>
          <p className="mt-4 text-[16px] leading-7 text-muted">
            Founder and team biographies are structured for this site and marked for review. Personal claims are not
            invented here.
          </p>
          <p className="mt-8 border border-border bg-white p-4 text-sm text-muted">
            Copy review required: leadership bios, organization size, and any client references.
          </p>
        </Container>
      </Section>
    </main>
  );
}
