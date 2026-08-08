/**
 * @ledgr/db — the only module permitted to talk to Postgres.
 *
 * `apps/web` must never import this; an ESLint rule enforces it. The web app is
 * a client of the Core API, not of the database.
 * See docs/adr/0002-three-layer-architecture.md.
 */
export { createPrismaClient } from "./client.js";
export type { LedgrPrismaClient, PrismaClientOptions } from "./client.js";

// Model types and enums, re-exported so consumers never reach into
// ../generated directly.
export * from "../generated/client/client.js";
