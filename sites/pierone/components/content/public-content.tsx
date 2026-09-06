import Link from "next/link";

import type { PublicContentResponse } from "@/lib/contracts";
import { buttonInverseClass, buttonPrimaryClass, buttonSecondaryClass } from "@/components/ui-classes";

function Cta({ href, label, onNavy }: { href?: string | null; label?: string | null; onNavy?: boolean }) {
  if (!href || !label) return null;
  const className = onNavy ? buttonInverseClass : href.startsWith("http") ? buttonSecondaryClass : buttonPrimaryClass;
  if (href.startsWith("http")) {
    return (
      <a href={href} className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

export function HomepageBanner({ banners }: { banners: PublicContentResponse["banners"] }) {
  const banner = banners[0];
  if (!banner) return null;
  const tone =
    banner.styleVariant === "teal" ? "bg-teal text-white" : banner.styleVariant === "light" ? "bg-white text-navy border-y border-border" : "bg-navy text-white";
  return (
    <div className={`${tone} px-6 py-5`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-serif text-2xl">{banner.title}</p>
          {banner.body ? <p className="mt-1 max-w-3xl text-sm leading-6 opacity-85">{banner.body}</p> : null}
        </div>
        <Cta href={banner.ctaUrl} label={banner.ctaLabel} onNavy={banner.styleVariant !== "light"} />
      </div>
    </div>
  );
}

export function SiteAnnouncement({
  announcements,
  placement,
}: {
  announcements: PublicContentResponse["announcements"];
  placement: "home" | "careers" | "skillbridge";
}) {
  const item = announcements.find((row) => row.placement === placement || row.placement === "site_wide");
  if (!item) return null;
  return (
    <div className="border-b border-border bg-white px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">Notice</p>
          <p className="mt-1 font-serif text-xl text-navy">{item.headline}</p>
          {item.body ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{item.body}</p> : null}
        </div>
        <Cta href={item.ctaUrl} label={item.ctaLabel} />
      </div>
    </div>
  );
}

export function UrgentHiringNotice({ notices }: { notices: PublicContentResponse["urgentNotices"] }) {
  const notice = notices[0];
  if (!notice) return null;
  const href = notice.ctaUrl ?? (notice.jobSlug ? `/jobs/${notice.jobSlug}` : null);
  return (
    <div className="mb-8 rounded-[6px] border border-teal/30 bg-[#f4f8f9] px-5 py-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">Now hiring</p>
      <p className="mt-2 font-serif text-2xl text-navy">{notice.headline}</p>
      {notice.body ? <p className="mt-2 text-sm leading-6 text-muted">{notice.body}</p> : null}
      {href && notice.ctaLabel ? (
        <div className="mt-4">
          <Cta href={href} label={notice.ctaLabel} />
        </div>
      ) : null}
    </div>
  );
}

export function FeaturedJobStrip({
  jobs,
  heading,
}: {
  jobs: PublicContentResponse["featuredJobs"];
  heading: string;
}) {
  if (!jobs.length) return null;
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-navy">{heading}</h2>
      <ul className="mt-4 divide-y divide-border border-y border-border">
        {jobs.map((job) => (
          <li key={job.slug}>
            <Link href={`/jobs/${job.slug}`} className="flex flex-col gap-1 py-4 md:flex-row md:items-baseline md:justify-between">
              <span className="font-serif text-xl text-navy">{job.title}</span>
              <span className="text-sm text-muted">{[job.companyDisplay, job.location].filter(Boolean).join(" · ")}</span>
            </Link>
            {job.featureCopy ? <p className="pb-4 text-sm text-muted">{job.featureCopy}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function IndustryCampaign({ campaigns }: { campaigns: PublicContentResponse["campaigns"] }) {
  const campaign = campaigns[0];
  if (!campaign) return null;
  return (
    <section className="mt-12 border border-border bg-white p-6 md:p-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal">
        {campaign.industry.replaceAll("-", " ")}
      </p>
      <h2 className="mt-3 font-serif text-3xl text-navy">{campaign.headline}</h2>
      {campaign.summary ? <p className="mt-3 max-w-3xl text-[16px] leading-7 text-muted">{campaign.summary}</p> : null}
      <div className="mt-5">
        <Cta href={campaign.ctaUrl} label={campaign.ctaLabel} />
      </div>
    </section>
  );
}
