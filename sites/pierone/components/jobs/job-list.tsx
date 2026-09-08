"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { PublicJob } from "@/lib/contracts";
import { fieldClass } from "@/components/ui-classes";

export function JobList({ jobs }: { jobs: PublicJob[] }) {
  const [location, setLocation] = useState("");
  const [jobType, setJobType] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [skillbridge, setSkillbridge] = useState(false);

  const jobTypes = useMemo(
    () => [...new Set(jobs.map((job) => job.employmentType).filter((value): value is string => Boolean(value)))],
    [jobs],
  );
  const workplaces = useMemo(
    () => [...new Set(jobs.map((job) => job.workplaceType).filter((value): value is string => Boolean(value)))],
    [jobs],
  );

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (location && !`${job.location ?? ""}`.toLowerCase().includes(location.toLowerCase())) return false;
      if (jobType && job.employmentType !== jobType) return false;
      if (workplace && job.workplaceType !== workplace) return false;
      if (skillbridge && !job.skillbridgeEligible) return false;
      return true;
    });
  }, [jobs, location, jobType, workplace, skillbridge]);

  return (
    <div>
      <form className="mb-8 grid gap-4 border border-border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => event.preventDefault()}>
        <label className="text-sm text-navy">
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} className={fieldClass} />
        </label>
        <label className="text-sm text-navy">
          Job type
          <select value={jobType} onChange={(event) => setJobType(event.target.value)} className={fieldClass}>
            <option value="">All</option>
            {jobTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-navy">
          Workplace
          <select value={workplace} onChange={(event) => setWorkplace(event.target.value)} className={fieldClass}>
            <option value="">All</option>
            {workplaces.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-navy">
          <input type="checkbox" checked={skillbridge} onChange={(event) => setSkillbridge(event.target.checked)} />
          SkillBridge-eligible only
        </label>
      </form>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No published roles match these filters.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border bg-white">
          {filtered.map((job) => (
            <li key={job.slug}>
              <Link href={`/jobs/${job.slug}`} className="group flex flex-col gap-2 px-5 py-5 hover:bg-background md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="block font-serif text-2xl text-navy group-hover:text-teal">{job.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {[job.companyDisplay, job.location].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <span className="flex flex-wrap gap-2 text-xs">
                  {job.employmentType ? (
                    <span className="rounded-[6px] border border-border px-2 py-1 text-muted">{job.employmentType}</span>
                  ) : null}
                  {job.workplaceType ? (
                    <span className="rounded-[6px] border border-border px-2 py-1 text-muted">{job.workplaceType}</span>
                  ) : null}
                  {job.skillbridgeEligible ? (
                    <span className="rounded-[6px] border border-teal/30 bg-teal/10 px-2 py-1 text-navy">SkillBridge-eligible</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
