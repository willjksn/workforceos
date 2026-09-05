export const PRIVACY_CLASS = {
  public: "public",
  internal: "internal",
  confidential: "confidential",
  restrictedPii: "restricted_pii",
} as const;

export type PrivacyClass = (typeof PRIVACY_CLASS)[keyof typeof PRIVACY_CLASS];

export function candidatePrivacyClass(): PrivacyClass {
  return PRIVACY_CLASS.restrictedPii;
}

export function isRestrictedPii(privacyClass: string) {
  return privacyClass === PRIVACY_CLASS.restrictedPii;
}
