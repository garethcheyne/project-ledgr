import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { createPrismaClient, type LedgrPrismaClient } from "@ledgr/db";
import { ENV, type Env } from "../config/env.js";

/**
 * Owns the single PrismaClient for the process.
 *
 * Prisma 7 has no Rust engine and takes its connection through a driver
 * adapter, so the client is built by a factory rather than subclassed the way
 * NestJS examples written for Prisma 5 do.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: LedgrPrismaClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = createPrismaClient({
      datasourceUrl: env.DATABASE_URL,
      logQueries: env.LOG_LEVEL === "debug" && !env.isProduction,
    });
  }

  async onModuleInit(): Promise<void> {
    // Connect eagerly so a bad DATABASE_URL fails at boot rather than on the
    // first user request.
    await this.client.$connect();
    this.logger.log("Database connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /** Lightweight liveness probe for the health endpoint. */
  async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
