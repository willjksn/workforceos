import { getServerEnv } from "../env";

export class SeedGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedGuardError";
  }
}

export function assertDevSeedAllowed() {
  const env = getServerEnv();
  const allow = process.env.ALLOW_DEV_SEED === "true";
  if (allow) return;
  if (env.NODE_ENV === "production") {
    throw new SeedGuardError(
      "Refusing to seed development fixtures while NODE_ENV=production. Use `npm run db:seed:prod` for production-safe catalog data.",
    );
  }
  if (process.env.VERCEL_ENV === "production") {
    throw new SeedGuardError(
      "Refusing to seed development fixtures on Vercel production. Use `npm run db:seed:prod`.",
    );
  }
}
