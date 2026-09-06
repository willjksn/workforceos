import { notFound } from "next/navigation";

import { PublicApplyForm } from "@/components/careers/public-apply-form";
import { getPublicJobBySlug } from "@/lib/hiring/service";

export default async function PublicJobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = await getPublicJobBySlug(slug);
  if (!job) notFound();
  return (
    <main className="min-h-full bg-[#F7F8F9] text-[#102A3A]">
      <header className="border-b border-[#DCE2E7] bg-[#0E2D4A] px-6 py-10 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4E7B8C]">Careers</p>
        <h1 className="mt-3 font-serif text-4xl">{job.title}</h1>
        <p className="mt-3 text-sm text-white/80">
          {[job.companyDisplay, job.location, job.employmentType, job.workplaceType].filter(Boolean).join(" · ")}
        </p>
      </header>
      <section className="mx-auto grid max-w-4xl gap-8 px-6 py-10 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="space-y-4">
          <div className="whitespace-pre-wrap text-sm leading-7">{job.description}</div>
          {job.skillbridgeEligible ? (
            <p className="border border-[#DCE2E7] bg-white p-4 text-sm leading-6">{job.skillbridgeDisclaimer}</p>
          ) : null}
        </article>
        <PublicApplyForm slug={job.slug} jobTitle={job.title} />
      </section>
    </main>
  );
}
