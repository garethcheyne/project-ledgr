import { z } from "zod";

/**
 * Environment validation.
 *
 * Parsed once at boot and the process exits on failure. A misconfigured service
 * that starts and then fails on the first request is far harder to diagnose
 * than one that refuses to start with a message naming the variable.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Distinct secrets are enforced below — a shared secret would let a refresh
  // token be presented as an access token, silently defeating short access
  // lifetimes.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  LEDGR_ENCRYPTION_KEY: z.string().min(1, "LEDGR_ENCRYPTION_KEY is required"),

  CORS_ORIGINS: z.string().default("http://localhost:5750"),
  PUBLIC_URL: z.string().default("http://localhost:3001"),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_BUCKET: z.string().default("ledgr-attachments"),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),

  // Absent credentials mean the provider simply isn't offered on the connect
  // screen — not an error. See docs/adr/0008-native-provider-apis.md.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  isProduction: boolean;
  googleOAuthConfigured: boolean;
  microsoftOAuthConfigured: boolean;
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(
      `Invalid environment configuration:\n${lines.join("\n")}\n\n` +
        "Copy .env.example to .env and fill in the missing values.",
    );
  }

  const env = parsed.data;

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.\n" +
        "Sharing one secret lets a refresh token be presented as an access token, " +
        "which defeats short access-token lifetimes entirely.\n" +
        "Generate two: openssl rand -base64 48",
    );
  }

  return {
    ...env,
    corsOrigins: env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    isProduction: env.NODE_ENV === "production",
    googleOAuthConfigured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    microsoftOAuthConfigured: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
  };
}

export const ENV = Symbol("LEDGR_ENV");
