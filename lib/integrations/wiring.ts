export type ProviderWiring = "mock" | "configured" | "live";

export type ProviderWiringStatus = {
  provider: string;
  configured: boolean;
  liveWired: boolean;
  wiring: ProviderWiring;
  liveLabel: "MOCK" | "MANUAL" | "CONFIGURED" | "LIVE";
  detail: string;
};

export function wiringFromFlags(input: {
  provider: string;
  configured: boolean;
  liveWired: boolean;
  mockDetail: string;
  configuredDetail: string;
  liveDetail: string;
  manualWhenUnconfigured?: boolean;
}): ProviderWiringStatus {
  const liveWired = Boolean(input.configured && input.liveWired);
  const configured = Boolean(input.configured);
  const wiring: ProviderWiring = liveWired ? "live" : configured ? "configured" : "mock";
  const liveLabel = liveWired
    ? "LIVE"
    : configured
      ? "CONFIGURED"
      : input.manualWhenUnconfigured
        ? "MANUAL"
        : "MOCK";
  return {
    provider: input.provider,
    configured,
    liveWired,
    wiring,
    liveLabel,
    detail: liveWired ? input.liveDetail : configured ? input.configuredDetail : input.mockDetail,
  };
}

export function neverLiveWithoutCredentials(configured: boolean, liveWired: boolean) {
  return Boolean(configured && liveWired);
}
