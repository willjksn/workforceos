export type ServiceEndProfile = {
  branch?: string | null;
  endOfServiceDate?: Date | null;
  etsDate?: Date | null;
  eaosDate?: Date | null;
  separationDate?: Date | null;
  retirementDate?: Date | null;
};

/** Navy/USMC language stored alongside EOS / separation / retirement. Does not invent mapping rules. */
export function serviceEndFields(profile: ServiceEndProfile) {
  return [
    { key: "eos", label: "EOS / End of service", value: profile.endOfServiceDate ?? null },
    { key: "ets", label: "ETS (Army / USMC)", value: profile.etsDate ?? null },
    { key: "eaos", label: "EAOS (Navy)", value: profile.eaosDate ?? null },
    { key: "separation", label: "Separation", value: profile.separationDate ?? null },
    { key: "retirement", label: "Retirement", value: profile.retirementDate ?? null },
  ] as const;
}

export function primaryServiceEndDate(profile: ServiceEndProfile) {
  return (
    profile.endOfServiceDate ??
    profile.etsDate ??
    profile.eaosDate ??
    profile.separationDate ??
    profile.retirementDate ??
    null
  );
}
