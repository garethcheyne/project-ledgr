import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import { EntitiesService, type EntitySummary } from "./entities.service.js";

@ApiTags("entities")
@Controller("entities")
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  @ApiOperation({ summary: "Companies for the current household" })
  list(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Query("search") search?: string,
  ): Promise<EntitySummary[]> {
    return this.entities.list(auth.householdId, search);
  }

  @Post()
  @ApiOperation({ summary: "Create a company" })
  create(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Body() body: { name: string; emailDomains?: string[] },
  ): Promise<EntitySummary> {
    return this.entities.create(auth.householdId, body);
  }

  @Get("suggest")
  @ApiOperation({ summary: "Suggest a company for a sender address" })
  suggest(@CurrentUser() auth: AuthenticatedRequest["auth"], @Query("address") address: string) {
    return this.entities.suggestForAddress(auth.householdId, address ?? "");
  }

  @Post(":id/backfill")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Attribute existing mail from this company's domains" })
  async backfill(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Param("id") id: string,
  ): Promise<{ linked: number }> {
    return { linked: await this.entities.backfillByDomain(auth.householdId, id) };
  }
}
