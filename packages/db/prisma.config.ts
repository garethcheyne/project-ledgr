// Prisma 7 does not auto-load .env for the config file — without this, every
// CLI invocation reports DATABASE_URL as missing.
import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * The connection URL lives here rather than in schema.prisma — Prisma 7 removed
 * `url` from the datasource block. This config is used by the CLI (migrate,
 * db push, studio); the runtime client is constructed separately with a driver
 * adapter in src/client.ts.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  datasource: {
    url: env("DATABASE_URL"),
    // Migrate needs a scratch database to diff against. Postgres in the compose
    // stack can create one on demand, so this is only set when the deployment
    // user lacks CREATEDB (managed Postgres, typically).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },

  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
});
