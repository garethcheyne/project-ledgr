import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.js";

export type { PrismaClient } from "../generated/client/client.js";

export interface PrismaClientOptions {
  /** Postgres connection string. Defaults to `DATABASE_URL`. */
  datasourceUrl?: string;
  /** Max pooled connections. Keep the total across all services under Postgres' `max_connections`. */
  maxConnections?: number;
  /** Emit query logs. Noisy — development only. */
  logQueries?: boolean;
}

/**
 * Builds a PrismaClient backed by the `pg` driver adapter.
 *
 * Prisma 7 removed the Rust query engine and the `url` datasource property, so
 * the connection is supplied here at construction rather than in the schema.
 * That is why this factory exists instead of `new PrismaClient()` at call sites.
 */
export function createPrismaClient(options: PrismaClientOptions = {}) {
  const connectionString = options.datasourceUrl ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
    max: options.maxConnections ?? 10,
  });

  return new PrismaClient({
    adapter,
    log: options.logQueries ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export type LedgrPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * The client handed to an interactive `$transaction` callback.
 *
 * Same model methods as the full client, minus the connection- and
 * transaction-level ones — you cannot open a transaction inside a transaction.
 * Exported so services can accept "either the client or a transaction" without
 * each one re-deriving this type.
 */
export type PrismaTransactionClient = Omit<
  LedgrPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;
