import type { Metadata } from "next";
import Link from "next/link";

import { BrandImage } from "@/components/media/brand-image";
import {
  FeaturedJobStrip,
  HomepageBanner,
  IndustryCampaign,
  SiteAnnouncement,
} from "@/components/content/public-content";
import { Container, CtaLink, Eyebrow, Heading, HorizonRule, Section } from "@/components/ui";
import { SERVICES, SITE_TAGLINE } from "@/lib/content";
import { IMAGES, INDUSTRY_TILES } from "@/lib/images";
import { workforceOsPublic } from "@/lib/workforceos/client";

export const metadata: Metadata = {
  title: "Workforce & Talent Solutions",
  description: SITE_TAGLINE,
};

const stages = [
  { name: "Solve", summary: "Immediate workforce needs", body: "Structured search and talent support for the roles that cannot wait." },
  { name: "Build", summary: "Talent pipelines and workforce capability", body: "Military talent strategy, pipeline design, and workforce planning for what comes next." },
  { name: "Operate", summary: "Sustained recruiting and workforce support", body: "Fractional talent leadership and operating cadence when the work needs to keep moving." },
];

export const revalidate = 60;

export default async function HomePage() {
  const content = await workforceOsPublic.getContent();
  return (
    <main>
      <HomepageBanner banners={content.banners} />
      <SiteAnnouncement announcements={content.announcements} placement="home" />
      <Section tone="navy">
        <div className="mx-auto grid max-w-6xl items-stretch lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-6 py-16 md:py-20 lg:pr-16">
            <Eyebrow className="text-[#9fc0cb]">Workforce & Talent Solutions</Eyebrow>
            <HorizonRule className="mt-5" />
            <h1 className="mt-6 max-w-xl font-serif text-4xl font-semibold leading-[1.12] tracking-tight text-white md:text-5xl">
              Build the workforce you need today — and the pipeline you’ll need tomorrow.
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-8 text-white/80">
              PierOne Partners helps organizations solve immediate talent needs while building stronger long-term
              workforce pipelines through search, military talent strategy, and workforce planning.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <CtaLink href="/contact" variant="inverse">
                Work With PierOne
              </CtaLink>
              <CtaLink href="/careers" variant="ghostOnNavy">
                Explore Careers
              </CtaLink>
            </div>
          </div>
          <div className="relative min-h-[360px] lg:min-h-[520px]">
            <BrandImage
              image={IMAGES.homeHero}
              radius={false}
              overlay
              priority
              fillParent
              className="rounded-none"
              sizes="(min-width: 1024px) 42vw, 100vw"
            />
          </div>
        </div>
      </Section>

      <Section>
        <Container size="narrow">
          <Eyebrow>The workforce challenge</Eyebrow>
          <HorizonRule className="mt-5" />
          <Heading>Immediate hiring needs and future pipelines are the same problem on different clocks.</Heading>
          <p className="mt-6 text-[17px] leading-8 text-muted">
            Organizations must fill roles now while preparing for the workforce they will need next. Those two clocks
            often run in separate conversations. PierOne connects them: search and talent operations for today, and
            structured workforce and military talent strategy for tomorrow.
          </p>
        </Container>
      </Section>

      <Section tone="white">
        <Container>
          <Eyebrow>Solutions</Eyebrow>
          <Heading>Five ways PierOne helps.</Heading>
          <ol className="mt-10 divide-y divide-border border-y border-border">
            {SERVICES.map((service, index) => (
              <li key={service.slug}>
                <Link
                  href={`/services/${service.slug}`}
                  className="group grid gap-3 py-6 md:grid-cols-[4.5rem_1fr_auto] md:items-baseline"
                >
                  <span className="font-serif text-2xl text-teal">0{index + 1}</span>
                  <div>
                    <span className="block font-serif text-2xl text-navy group-hover:text-teal">{service.name}</span>
                    <span className="mt-2 block max-w-2xl text-sm leading-6 text-muted">{service.short}</span>
                  </div>
                  <span className="text-sm text-teal transition-transform group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-2" pad="default">
          <BrandImage image={IMAGES.military} overlay sizes="(min-width: 1024px) 40vw, 100vw" />
          <div>
            <Eyebrow>Military talent</Eyebrow>
            <Heading>Military experience is workforce experience.</Heading>
            <p className="mt-5 text-[17px] leading-8 text-muted">
              PierOne translates military occupations and skills into civilian work, maps installation talent geography,
              and identifies SkillBridge and other transition pathways where they actually fit. The work is disciplined
              mapping, not a guarantee of approval or hire.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href="/military-talent">Explore Military Talent</CtaLink>
              <CtaLink href="/skillbridge" variant="secondary">
                View SkillBridge Opportunities
              </CtaLink>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="navy">
        <Container>
          <Eyebrow className="text-[#9fc0cb]">How PierOne works</Eyebrow>
          <Heading className="text-white">Solve. Build. Operate.</Heading>
          <ol className="mt-10 grid gap-0 md:grid-cols-3">
            {stages.map((stage, index) => (
              <li key={stage.name} className="border-white/15 py-6 md:border-l md:px-8 md:first:border-l-0 md:first:pl-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#9fc0cb]">0{index + 1}</div>
                <h3 className="mt-3 font-serif text-3xl text-white">{stage.name}</h3>
                <p className="mt-2 text-sm font-medium text-[#c5d5dc]">{stage.summary}</p>
                <p className="mt-3 text-sm leading-6 text-white/75">{stage.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Workforce intelligence</Eyebrow>
            <Heading>Pipelines start with demand, supply, and critical roles.</Heading>
            <p className="mt-5 text-[17px] leading-8 text-muted">
              Workforce Pipeline Assessment looks at labor markets, skills gaps, military overlay where relevant, and
              recommended pipeline actions. It is advisory work with stated assumptions, not a guarantee of future
              supply.
            </p>
            <div className="mt-8">
              <CtaLink href="/workforce-development" variant="secondary">
                Workforce Development
              </CtaLink>
            </div>
          </div>
          <BrandImage image={IMAGES.homeInfrastructure} overlay sizes="(min-width: 1024px) 40vw, 100vw" />
        </Container>
      </Section>

      <Section tone="white">
        <Container>
          <Eyebrow>Industries</Eyebrow>
          <Heading>Where workforce constraints show up clearly.</Heading>
          <p className="mt-4 max-w-2xl text-sm text-muted">
            Emphasis areas, not a claim that PierOne currently serves named clients in each industry.
          </p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_TILES.filter((tile) => tile.emphasis === "primary").map((tile) => (
              <li key={tile.name} className="group relative overflow-hidden rounded-[6px]">
                <BrandImage image={tile.image} overlay radius={false} sizes="(min-width: 1024px) 22vw, 50vw" />
                <div className="absolute inset-x-0 bottom-0 bg-navy/75 px-4 py-3 text-sm font-medium text-white">{tile.name}</div>
              </li>
            ))}
          </ul>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_TILES.filter((tile) => tile.emphasis === "secondary").map((tile) => (
              <li key={tile.name} className="relative overflow-hidden rounded-[6px]">
                <BrandImage image={tile.image} overlay radius={false} sizes="(min-width: 1024px) 22vw, 50vw" />
                <div className="absolute inset-x-0 bottom-0 bg-navy/75 px-4 py-3 text-sm font-medium text-white">{tile.name}</div>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section className="relative overflow-hidden" tone="navy">
        <div className="absolute inset-0 opacity-30">
          <BrandImage
            image={IMAGES.careers}
            overlay
            radius={false}
            fillParent
            className="rounded-none"
            sizes="100vw"
          />
        </div>
        <Container className="relative">
          <Eyebrow className="text-white/70">Careers & SkillBridge</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-serif text-3xl font-semibold md:text-5xl">Your next opportunity may start here.</h2>
          <p className="mt-4 max-w-2xl text-white/80">
            Open roles are published from WorkforceOS. Applying does not guarantee an interview. SkillBridge depends on
            employer needs and approval requirements.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href="/careers" variant="inverse">
              Explore Careers
            </CtaLink>
            <CtaLink href="/skillbridge" variant="ghostOnNavy">
              Explore SkillBridge
            </CtaLink>
          </div>
        </Container>
      </Section>

      {content.featuredJobs.length || content.featuredSkillBridge.length || content.campaigns.length ? (
        <Section>
          <Container>
            <FeaturedJobStrip jobs={content.featuredJobs} heading="Featured roles" />
            <FeaturedJobStrip jobs={content.featuredSkillBridge} heading="Featured SkillBridge roles" />
            <IndustryCampaign campaigns={content.campaigns} />
          </Container>
        </Section>
      ) : null}

      <Section tone="white">
        <Container size="narrow">
          <Eyebrow>Work with PierOne</Eyebrow>
          <Heading>If you are building a workforce, start a conversation.</Heading>
          <p className="mt-4 text-muted">
            Search, military talent strategy, talent acquisition performance, fractional leadership, or pipeline
            assessment — tell us the constraint.
          </p>
          <div className="mt-8">
            <CtaLink href="/contact">Work With PierOne</CtaLink>
          </div>
        </Container>
      </Section>
    </main>
  );
}
