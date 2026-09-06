import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InquiryForm } from "@/components/forms/inquiry-form";
import { Container, PageHero, Section } from "@/components/ui";
import { SERVICES, serviceBySlug } from "@/lib/content";

export function generateStaticParams() {
  return SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return { title: "Service" };
  return { title: service.name, description: service.short };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();
  return (
    <main>
      <PageHero eyebrow="Solutions" title={service.name}>
        <p className="mt-6 max-w-2xl text-[17px] leading-8 text-white/80">{service.short}</p>
      </PageHero>
      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
            <div className="space-y-10 text-[16px] leading-7 text-muted">
              <section>
                <h2 className="font-serif text-2xl text-navy">The problem</h2>
                <p className="mt-3">{service.problem}</p>
              </section>
              <section>
                <h2 className="font-serif text-2xl text-navy">What PierOne does</h2>
                <p className="mt-3">{service.whatWeDo}</p>
              </section>
              <section>
                <h2 className="font-serif text-2xl text-navy">What the client receives</h2>
                <p className="mt-3">{service.clientReceives}</p>
              </section>
              <section>
                <h2 className="font-serif text-2xl text-navy">Who it is for</h2>
                <p className="mt-3">{service.whoFor}</p>
              </section>
              <section>
                <h2 className="font-serif text-2xl text-navy">Typical engagement</h2>
                <p className="mt-3">{service.engagement}</p>
              </section>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-navy">Start a conversation</h2>
              <p className="mt-2 mb-6 text-sm text-muted">This form creates a WorkforceOS inquiry. It is not a commitment.</p>
              <InquiryForm defaultService={service.code} pagePath={`/services/${service.slug}`} />
            </div>
          </div>
        </Container>
      </Section>
    </main>
  );
}
