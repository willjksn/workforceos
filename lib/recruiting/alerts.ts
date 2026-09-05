export type RecruitingAlert = {
  code: string;
  title: string;
  recordType: string;
  recordId: string;
  href: string;
};

const DEFAULTS = {
  inactiveJobDays: 7,
  followUpDays: 5,
  interviewFeedbackDays: 3,
  offerExpiringDays: 3,
  guaranteeWarningDays: 14,
};

export function stalledRecruitingAlerts(input: {
  jobs: Array<{ id: string; title: string; status: string; lastActivityAt?: Date | null; createdAt: Date; intakeComplete: boolean }>;
  matches: Array<{ id: string; jobId: string; candidateName: string; pipelineStatus: string; updatedAt: Date }>;
  submissions: Array<{ id: string; jobId: string; status: string; submittedAt?: Date | null }>;
  interviews: Array<{ id: string; jobId: string; status: string; completedAt?: Date | null; clientFeedback?: string | null; clientFeedbackDueAt?: Date | null }>;
  offers: Array<{ id: string; jobId: string; status: string; expirationDate?: Date | null }>;
  guarantees: Array<{ id: string; status: string; endsOn: Date }>;
  now?: Date;
}): RecruitingAlert[] {
  const now = input.now ?? new Date();
  const alerts: RecruitingAlert[] = [];
  const daysAgo = (value: Date) => (now.getTime() - value.getTime()) / (1000 * 60 * 60 * 24);

  for (const job of input.jobs) {
    if (!job.intakeComplete) {
      alerts.push({
        code: "job_intake_incomplete",
        title: `${job.title} is missing intake fields`,
        recordType: "job",
        recordId: job.id,
        href: `/app/jobs/${job.id}`,
      });
    }
    const last = job.lastActivityAt ?? job.createdAt;
    if (["open", "search_active"].includes(job.status) && daysAgo(last) >= DEFAULTS.inactiveJobDays) {
      alerts.push({
        code: "job_inactive",
        title: `${job.title} has had no candidate activity in ${DEFAULTS.inactiveJobDays}+ days`,
        recordType: "job",
        recordId: job.id,
        href: `/app/jobs/${job.id}/pipeline`,
      });
    }
  }

  for (const match of input.matches) {
    if (["contacted", "interested", "screening"].includes(match.pipelineStatus) && daysAgo(match.updatedAt) >= DEFAULTS.followUpDays) {
      alerts.push({
        code: "candidate_follow_up",
        title: `${match.candidateName} is awaiting follow-up`,
        recordType: "candidate_job_match",
        recordId: match.id,
        href: `/app/jobs/${match.jobId}/pipeline`,
      });
    }
  }

  for (const submission of input.submissions) {
    if (submission.status === "submitted" && submission.submittedAt && daysAgo(submission.submittedAt) >= DEFAULTS.interviewFeedbackDays) {
      alerts.push({
        code: "submission_feedback",
        title: "Submission awaiting client feedback",
        recordType: "submission",
        recordId: submission.id,
        href: `/app/submissions`,
      });
    }
  }

  for (const interview of input.interviews) {
    const due = interview.clientFeedbackDueAt;
    if (interview.status === "completed" && !interview.clientFeedback && due && due < now) {
      alerts.push({
        code: "interview_feedback_overdue",
        title: "Interview client feedback is overdue",
        recordType: "interview",
        recordId: interview.id,
        href: `/app/interviews`,
      });
    }
  }

  for (const offer of input.offers) {
    if (offer.status === "extended" && offer.expirationDate) {
      const days = (offer.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (days <= DEFAULTS.offerExpiringDays) {
        alerts.push({
          code: "offer_expiring",
          title: "Offer is expiring soon",
          recordType: "offer",
          recordId: offer.id,
          href: `/app/offers`,
        });
      }
    }
  }

  for (const guarantee of input.guarantees) {
    if (guarantee.status === "expiring_soon" || guarantee.status === "replacement_required") {
      alerts.push({
        code: "guarantee_expiring",
        title: "Placement guarantee needs review",
        recordType: "placement_guarantee",
        recordId: guarantee.id,
        href: `/app/placements`,
      });
    }
  }

  return alerts;
}
