import Link from "next/link";

import { listPublicJobs } from "@/lib/hiring/service";

export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const jobs = await listPublicJobs();
  return (
    <main className="min-h-full bg-[#F7F8F9] text-[#102A3A]">
      <header className="border-b border-[#DCE2E7] bg-[#0E2D4A] px-6 py-10 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-[#4E7B8C]">PierOne Partners</p>
        <h1 className="mt-3 font-serif text-4xl">Careers</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
          Open roles at PierOne Partners and selected client and SkillBridge opportunities. Applying does not guarantee an interview.
        </p>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-10">
        {jobs.length === 0 ? (
          <p className="text-sm text-[#6B7280]">There are no public openings right now.</p>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.slug} className="border border-[#DCE2E7] bg-white p-5">
                <Link href={`/jobs/${job.slug}`} className="font-serif text-2xl text-[#0E2D4A]">
                  {job.title}
                </Link>
                <p className="mt-2 text-sm text-[#6B7280]">
                  {[job.companyDisplay, job.location, job.employmentType].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
