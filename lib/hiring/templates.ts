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

export function onboardingWelcomeEmail(input: { firstName: string; startDate?: string | null }) {
  return {
    subject: "Onboarding welcome — PierOne Partners",
    html: brandedEmail({
      heading: "Welcome",
      bodyHtml: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Your onboarding tasks are ready${input.startDate ? ` for a start date of ${escapeHtml(input.startDate)}` : ""}.</p>`,
    }),
    text: `Welcome. Your onboarding tasks are ready.`,
  };
}

export function skillbridgePublicDisclaimer() {
  return "SkillBridge participation is subject to applicable service and command approval and employer requirements. Applying does not guarantee placement, approval, or employment.";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
