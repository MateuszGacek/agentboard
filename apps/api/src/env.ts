import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_URL: z.string().url().default("http://localhost:5173"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  DEMO_SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24)
});

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().trim().min(1)
});

export type ApiEnv = z.infer<typeof baseEnvSchema>;
export type ApiDatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function loadEnv(): ApiEnv {
  const parsed = baseEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten();
    throw new Error(
      `API environment validation failed. Check .env.example and set required variables. ${JSON.stringify(
        formatted.fieldErrors
      )}`
    );
  }

  return parsed.data;
}

export function loadDatabaseEnv(): ApiDatabaseEnv {
  const parsed = databaseEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const formatted = parsed.error.flatten();
    throw new Error(
      `API database environment validation failed. Check .env.example and set DATABASE_URL before enabling DB-backed routes. ${JSON.stringify(
        formatted.fieldErrors
      )}`
    );
  }

  return parsed.data;
}

export function getOptionalDatabaseUrl(): string | undefined {
  const parsed = databaseEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data.DATABASE_URL;
}

export function isProduction(env: Pick<ApiEnv, "NODE_ENV">) {
  return env.NODE_ENV === "production";
}
