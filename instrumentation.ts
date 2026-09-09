import type { Instrumentation } from "next";

export async function register() {
  const { initOfficialSentry } = await import("./lib/observability/sentry");
  await initOfficialSentry();
  const { logServerEvent } = await import("./lib/observability/monitor");
  logServerEvent("app.start", {
    version: process.env.APP_VERSION ?? "0.1.0",
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { captureException } = await import("./lib/observability/monitor");
  await captureException(error, {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
  });
};
