export const LEGAL_TEMPLATE_DRAFT_LABEL = "DRAFT — NOT APPROVED FOR USE";
export const LEGAL_TEMPLATE_APPROVED_LABEL = "ATTORNEY APPROVED";

export function legalTemplateUseLabel(attorneyApproved: boolean) {
  return attorneyApproved ? LEGAL_TEMPLATE_APPROVED_LABEL : LEGAL_TEMPLATE_DRAFT_LABEL;
}

export const LEGAL_TEMPLATE_LIST_DESCRIPTION =
  "This list is the template library, including drafts. Click a name to read the stored language. Use a template only when it is ATTORNEY APPROVED. Everything else is DRAFT — NOT APPROVED FOR USE.";

export const LEGAL_DRAFT_SOW =
  "Draft language — not approved for use until counsel records attorney approval on the linked template.";
