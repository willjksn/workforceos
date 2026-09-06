import type { Metadata } from "next";

import { InquiryForm } from "@/components/forms/inquiry-form";
import { BrandImage } from "@/components/media/brand-image";
import { Container, Eyebrow, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";

export const metadata: Metadata = { title: "Work With PierOne", description: "Contact PierOne Partners about workforce and talent needs." };

export default function ContactPage() {
  return (
    <main>
      <Section tone="navy">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_22rem]">
            <div>
              <Eyebrow className="text-[#9fc0cb]">Contact</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white">Work With PierOne</h1>
              <p className="mt-4 max-w-2xl text-[17px] leading-8 text-white/80">
                Tell us about the hiring or workforce challenge. This form creates a WorkforceOS inquiry for human review.
              </p>
            </div>
            <BrandImage image={IMAGES.contact} overlay sizes="(min-width: 1024px) 22vw, 100vw" />
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <div className="max-w-3xl">
            <InquiryForm pagePath="/contact" />
          </div>
        </Container>
      </Section>
    </main>
  );
}
