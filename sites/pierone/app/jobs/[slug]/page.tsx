import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ApplyForm } from "@/components/forms/apply-form";
import { Container, Eyebrow, Section } from "@/components/ui";
import { workforceOsPublic } from "@/lib/workforceos/client";
import { siteUrl } from "@/lib/content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const job = await workforceOsPublic.getJob(slug);
    if (!job) return { title: "Role unavailable" };
    return {
      title: job.title,
      description: job.location ? `${job.title} · ${job.location}` : job.title,
    };
  } catch {
    return { title: "Role unavailable" };
  }
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let job;
  try {
    job = await workforceOsPublic.getJob(slug);
  } catch {
    return (
      <main>
        <Section>
          <Container>
            <p className="text-muted">This role cannot be loaded right now. Please try again shortly.</p>
          </Container>
        </Section>
      </main>
    );
  }
  if (!job) notFound();
  const closed = job.applicationOpen === false;
  const meta = [job.companyDisplay, job.location, job.workplaceType, job.employmentType].filter(Boolean);
  const jobPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description ?? job.title,
    datePosted: job.publishedAt ?? undefined,
    validThrough: job.expiresAt ?? undefined,
    employmentType: job.employmentType ?? undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: job.companyDisplay ?? "PierOne Partners",
    },
    jobLocation: job.location
      ? {
          "@type": "Place",
          address: job.location,
        }
      : undefined,
    url: `${siteUrl()}/jobs/${job.slug}`,
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }} />
      <Section tone="navy">
        <Container>
          <Eyebrow className="text-[#9fc0cb]">Careers</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-semibold tracking-tight text-white">{job.title}</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            {meta.map((item) => (
              <span key={item} className="rounded-[6px] border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-white/85">
                {item}
              </span>
            ))}
            {job.skillbridgeEligible ? (
              <span className="rounded-[6px] border border-teal/40 bg-teal/20 px-2.5 py-1 text-xs text-white">
                SkillBridge
              </span>
            ) : null}
          </div>
          {job.salaryDisplay ? <p className="mt-4 text-sm text-white/80">{job.salaryDisplay}</p> : null}
          {job.skillbridgeEligible ? (
            <p className="mt-4 max-w-2xl text-sm text-white/75">
              {job.skillbridgeDisclaimer ??
                "SkillBridge participation depends on employer needs and approval requirements. Applying does not guarantee approval or employment."}
            </p>
          ) : null}
        </Container>
      </Section>
      <Section>
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <article className="max-w-3xl whitespace-pre-wrap text-[16px] leading-7 text-muted">{job.description}</article>
            <aside className="lg:sticky lg:top-28 lg:self-start">
              {closed ? (
                <p className="rounded-[6px] border border-border bg-white p-6 text-sm text-muted">
                  This role is not accepting applications.
                </p>
              ) : (
                <ApplyForm slug={job.slug} jobTitle={job.title} />
              )}
            </aside>
          </div>
        </Container>
      </Section>
    </main>
  );
}
