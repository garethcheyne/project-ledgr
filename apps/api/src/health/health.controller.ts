import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Liveness and database connectivity" })
  async check(): Promise<{ status: string; database: string; uptime: number }> {
    const database = (await this.prisma.ping()) ? "up" : "down";

    // Report unhealthy when the database is unreachable — otherwise the
    // container healthcheck passes while every real request fails.
    if (database === "down") {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        message: "The database is unreachable.",
      });
    }

    return { status: "ok", database, uptime: Math.floor(process.uptime()) };
  }
}
