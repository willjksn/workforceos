const NAVY = "#0E2D4A";
const TEAL = "#4E7B8C";

export function brandedEmail(input: { heading: string; bodyHtml: string; footer?: string }) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#F7F8F9;font-family:Inter,Arial,sans-serif;color:#102A3A;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F9;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #DCE2E7;">
        <tr><td style="background:${NAVY};padding:20px 28px;color:#ffffff;font-family:Georgia,'Cormorant Garamond',serif;font-size:22px;">PierOne Partners</td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Cormorant Garamond',serif;font-size:24px;color:${NAVY};">${input.heading}</h1>
          <div style="font-size:15px;line-height:1.6;color:#102A3A;">${input.bodyHtml}</div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #DCE2E7;color:#6B7280;font-size:12px;">
          ${input.footer ?? "This message was sent by WorkforceOS on behalf of PierOne Partners. It does not guarantee an interview or employment."}
          <div style="margin-top:8px;color:${TEAL};">pieronepartners.com</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function applicationReceivedEmail(input: { firstName: string; jobTitle: string; appliedAt: Date }) {
  const heading = "Application received";
  const bodyHtml = `<p>Hello ${escapeHtml(input.firstName)},</p>
<p>We received your application for <strong>${escapeHtml(input.jobTitle)}</strong> on ${input.appliedAt.toLocaleDateString()}.</p>
<p>Our team will review your materials. We will contact you if there is a next step. Receiving this confirmation does not mean an interview has been scheduled.</p>`;
  return {
    subject: `Application received — ${input.jobTitle}`,
    html: brandedEmail({ heading, bodyHtml }),
    text: `Hello ${input.firstName}, we received your application for ${input.jobTitle}. We will contact you if there is a next step.`,
  };
}

export function interviewInvitationEmail(input: { firstName: string; jobTitle: string; when: Date }) {
  const heading = "Interview invitation";
  const bodyHtml = `<p>Hello ${escapeHtml(input.firstName)},</p>
<p>You are invited to interview for <strong>${escapeHtml(input.jobTitle)}</strong> on ${input.when.toLocaleString()}.</p>`;
  return {
    subject: `Interview invitation — ${input.jobTitle}`,
    html: brandedEmail({ heading, bodyHtml }),
    text: `Interview invitation for ${input.jobTitle} on ${input.when.toLocaleString()}.`,
  };
}

export function interviewReminderEmail(input: { firstName: string; jobTitle: string; when: Date }) {
  return {
    subject: `Interview reminder — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Interview reminder",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>This is a reminder of your interview for <strong>${escapeHtml(input.jobTitle)}</strong> on ${input.when.toLocaleString()}.</p>`,
    }),
    text: `Reminder: interview for ${input.jobTitle} on ${input.when.toLocaleString()}.`,
  };
}

export function offerNoticeEmail(input: { firstName: string; jobTitle: string }) {
  return {
    subject: `Offer available — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Offer available",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>An offer for <strong>${escapeHtml(input.jobTitle)}</strong> is ready for your review.</p>`,
    }),
    text: `An offer for ${input.jobTitle} is ready for your review.`,
  };
}

export function onboardingWelcomeEmail(input: { firstName: string; startDate?: string | null; accessUrl?: string | null }) {
  const access = input.accessUrl
    ? `<p>Complete your new-hire tasks here (no WorkforceOS login): <a href="${escapeHtml(input.accessUrl)}">${escapeHtml(input.accessUrl)}</a></p>`
    : "";
  return {
    subject: "Onboarding welcome — PierOne Partners",
    html: brandedEmail({
      heading: "Welcome",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your onboarding tasks are ready${input.startDate ? ` for a start date of ${escapeHtml(input.startDate)}` : ""}.</p>${access}<p>This is hire onboarding, not PierOne staff Academy training.</p>`,
    }),
    text: `Welcome. Your onboarding tasks are ready.${input.accessUrl ? ` Complete them at ${input.accessUrl}` : ""}`,
  };
}

export function interviewConfirmationEmail(input: { firstName: string; jobTitle: string; when: Date }) {
  return {
    subject: `Interview confirmed — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Interview confirmed",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your interview for <strong>${escapeHtml(input.jobTitle)}</strong> is confirmed for ${input.when.toLocaleString()}.</p>`,
    }),
    text: `Interview confirmed for ${input.jobTitle} on ${input.when.toLocaleString()}.`,
  };
}

export function interviewRescheduledEmail(input: { firstName: string; jobTitle: string; when: Date }) {
  return {
    subject: `Interview rescheduled — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Interview rescheduled",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your interview for <strong>${escapeHtml(input.jobTitle)}</strong> was rescheduled to ${input.when.toLocaleString()}.</p>`,
    }),
    text: `Interview for ${input.jobTitle} rescheduled to ${input.when.toLocaleString()}.`,
  };
}

export function interviewCancelledEmail(input: { firstName: string; jobTitle: string }) {
  return {
    subject: `Interview cancelled — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Interview cancelled",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your interview for <strong>${escapeHtml(input.jobTitle)}</strong> has been cancelled. We will contact you if a new time is offered.</p>`,
    }),
    text: `Interview for ${input.jobTitle} has been cancelled.`,
  };
}

export function resumeRequestEmail(input: { firstName: string; jobTitle: string }) {
  return {
    subject: `Resume needed — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Resume needed",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Please send a PDF, DOC, or DOCX resume for <strong>${escapeHtml(input.jobTitle)}</strong> so we can continue review.</p>`,
    }),
    text: `Please send a PDF, DOC, or DOCX resume for ${input.jobTitle}.`,
  };
}

export function applicationUpdateEmail(input: { firstName: string; jobTitle: string; message: string }) {
  return {
    subject: `Application update — ${input.jobTitle}`,
    html: brandedEmail({
      heading: "Application update",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>${escapeHtml(input.message)}</p>`,
    }),
    text: input.message,
  };
}

export function backgroundCheckNextStepEmail(input: { firstName: string }) {
  return {
    subject: "Background check — next step",
    html: brandedEmail({
      heading: "Background check next step",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>A background check may be required for this role. A recruiter will send the next step. This message is not a hiring decision.</p>`,
    }),
    text: "A recruiter will send the next step for a background check. This is not a hiring decision.",
  };
}

export function drugScreenNextStepEmail(input: { firstName: string }) {
  return {
    subject: "Drug screen — next step",
    html: brandedEmail({
      heading: "Drug screen next step",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>If a drug screen is required, a recruiter will send collection instructions. WorkforceOS uses a manual workflow until a vendor is selected.</p>`,
    }),
    text: "If a drug screen is required, a recruiter will send collection instructions.",
  };
}

export function onboardingReminderEmail(input: { firstName: string; taskTitle: string }) {
  return {
    subject: "Onboarding reminder — PierOne Partners",
    html: brandedEmail({
      heading: "Onboarding reminder",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>This is a reminder that <strong>${escapeHtml(input.taskTitle)}</strong> is still open.</p>`,
    }),
    text: `Reminder: ${input.taskTitle} is still open.`,
  };
}

export function startDateReminderEmail(input: { firstName: string; startDate: string }) {
  return {
    subject: "Start date reminder — PierOne Partners",
    html: brandedEmail({
      heading: "Start date reminder",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your recorded start date is ${escapeHtml(input.startDate)}.</p>`,
    }),
    text: `Your recorded start date is ${input.startDate}.`,
  };
}

export function skillbridgePublicDisclaimer() {
  return "This is a SkillBridge-eligible employer or host-company opportunity facilitated by PierOne. PierOne is not automatically the host. Participation is subject to applicable service and command approval and employer requirements. Applying does not guarantee placement, approval, or employment.";
}

export function inquiryAcknowledgementEmail(input: { firstName: string }) {
  const heading = "Thank you for contacting PierOne Partners";
  const bodyHtml = `<p>Hello ${escapeHtml(input.firstName)},</p>
<p>We received your message. A member of the PierOne team will review it and follow up if there is a fit.</p>
<p>This acknowledgement does not confirm an engagement or a meeting.</p>`;
  return {
    subject: "Thank you for contacting PierOne Partners",
    html: brandedEmail({ heading, bodyHtml, footer: "This message was sent by WorkforceOS on behalf of PierOne Partners." }),
    text: `Hello ${input.firstName}, we received your message. A member of the PierOne team will review it.`,
  };
}

export function militaryTalentAcknowledgementEmail(input: { firstName: string }) {
  const heading = "Thanks for joining the PierOne Military Talent Network";
  const bodyHtml = `<p>Hello ${escapeHtml(input.firstName)},</p>
<p>Thanks for joining the PierOne Military Talent Network. We received your Transition Talent Profile. Our team may use your military experience, career goals, location preferences, and transition timing to identify potential employer and SkillBridge-eligible opportunities.</p>
<p>Joining the network does not enroll you in a PierOne SkillBridge program and does not guarantee a SkillBridge approval, an interview, placement, or employment. PierOne is the intermediary between transitioning service members and employer/host-company opportunities. SkillBridge is one possible pathway when a host employer, timing, and approval requirements align.</p>`;
  return {
    subject: "Thanks for joining the PierOne Military Talent Network",
    html: brandedEmail({ heading, bodyHtml }),
    text: `Hello ${input.firstName}, thanks for joining the PierOne Military Talent Network. We received your Transition Talent Profile. Our team may use your military experience, career goals, location preferences, and transition timing to identify potential employer and SkillBridge-eligible opportunities. This does not enroll you in a PierOne SkillBridge program and does not guarantee placement, interview, SkillBridge approval, or employment.`,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
