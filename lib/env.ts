import { z } from "zod";

if (typeof window !== "undefined") {
  throw new Error("lib/env.ts is server-only and must not be imported in client components.");
}

const emptyToUndefined = (value: unknown) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: optionalString,
  DATABASE_URL: optionalString,
  DATABASE_URL_UNPOOLED: optionalString,
  NEON_BRANCH: optionalString,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalString,
  CLERK_SECRET_KEY: optionalString,
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: optionalString,
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: optionalString,
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: optionalString,
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: optionalString,
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
  STORAGE_PROVIDER: z.preprocess(
    emptyToUndefined,
    z.enum(["local", "s3"]).optional(),
  ),
  LOCAL_STORAGE_DIR: optionalString,
  S3_BUCKET: optionalString,
  S3_REGION: optionalString,
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  AI_PROVIDER: optionalString,
  AI_API_KEY: optionalString,
  SENTRY_DSN: optionalString,
  NEXT_PUBLIC_APP_URL: optionalString,
  APP_URL: optionalString,
  QUICKBOOKS_CLIENT_ID: optionalString,
  QUICKBOOKS_CLIENT_SECRET: optionalString,
  DOCUSIGN_INTEGRATION_KEY: optionalString,
  DOCUSIGN_USER_ID: optionalString,
  DOCUSIGN_SECRET_KEY: optionalString,
  APOLLO_API_KEY: optionalString,
  ONET_API_KEY: optionalString,
  SEEKOUT_API_KEY: optionalString,
  MICROSOFT_CLIENT_ID: optionalString,
  MICROSOFT_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  INTEGRATION_WEBHOOK_SECRET: optionalString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = readServerEnv();
  }
  return cached;
}

export function resetServerEnvCache() {
  cached = undefined;
}

export function isClerkConfigured(env: ServerEnv = getServerEnv()) {
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export function isInngestConfigured(env: ServerEnv = getServerEnv()) {
  return Boolean(env.INNGEST_EVENT_KEY && env.INNGEST_SIGNING_KEY);
}

export function requireDatabaseUrl(env: ServerEnv = getServerEnv()): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing. Set a Neon PostgreSQL connection string in .env.local before running database commands.",
    );
  }
  return env.DATABASE_URL;
}

export function requireClerkKeys(env: ServerEnv = getServerEnv()) {
  if (!isClerkConfigured(env)) {
    throw new Error(
      "Clerk is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local.",
    );
  }
  return {
    publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY as string,
    secretKey: env.CLERK_SECRET_KEY as string,
  };
}

export function getAppUrl(env: ServerEnv = getServerEnv()): string | undefined {
  const configured = env.NEXT_PUBLIC_APP_URL ?? env.APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/$/, "")}`;
  if (env.NODE_ENV !== "production") return "http://localhost:3000";
  return undefined;
}
