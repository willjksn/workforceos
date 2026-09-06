import type { Metadata } from "next";

import type { PublicJob } from "@/lib/contracts";
import { JobList } from "@/components/jobs/job-list";
import { FeaturedJobStrip, SiteAnnouncement, UrgentHiringNotice } from "@/components/content/public-content";
import { BrandImage } from "@/components/media/brand-image";
import { Container, Eyebrow, HorizonRule, Section } from "@/components/ui";
import { IMAGES } from "@/lib/images";
import { workforceOsPublic } from "@/lib/workforceos/client";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open roles published by PierOne Partners. Applying does not guarantee an interview.",
};

export const revalidate = 60;

export default async function CareersPage() {
  let jobs: PublicJob[] = [];
  let unavailable = false;
  const content = await workforceOsPublic.getContent();
  try {
    jobs = await workforceOsPublic.getJobs();
  } catch {
    unavailable = true;
  }
  return (
    <main>
      <SiteAnnouncement announcements={content.announcements} placement="careers" />
      <Section tone="navy">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="text-[#9fc0cb]">Careers</Eyebrow>
              <HorizonRule className="mt-5" />
              <h1 className="mt-6 font-serif text-4xl font-semibold tracking-tight text-white">Open roles</h1>
              <p className="mt-4 max-w-xl text-[17px] leading-8 text-white/80">
                Roles appear here only when WorkforceOS marks them public and open. Closing a job in WorkforceOS removes
                it from this list without a website deploy. Applying does not guarantee an interview.
              </p>
            </div>
            <BrandImage image={IMAGES.careers} overlay sizes="(min-width: 1024px) 42vw, 100vw" />
          </div>
        </Container>
      </Section>
      <Section>
        <Container>
          <UrgentHiringNotice notices={content.urgentNotices} />
          <FeaturedJobStrip jobs={content.featuredJobs} heading="Featured roles" />
          {unavailable ? (
            <p className="text-sm text-muted">Current opportunities are temporarily unavailable. Please try again shortly.</p>
          ) : (
            <JobList jobs={jobs} />
          )}
        </Container>
      </Section>
    </main>
  );
}
