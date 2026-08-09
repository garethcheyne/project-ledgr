import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  type AuthResponse,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
} from "@ledgr/contracts";
import type { Request } from "express";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService, type RequestContext } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthenticatedRequest } from "./jwt-auth.guard.js";
import { Public } from "./public.decorator.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Create an account and its household" })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.auth.register(body, contextFrom(request));
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Sign in" })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.auth.login(body, contextFrom(request));
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange a refresh token for a new session" })
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput,
    @Req() request: Request,
  ): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken, contextFrom(request));
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Revoke a refresh token" })
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshInput): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  @Get("me")
  @ApiOperation({ summary: "The current session's user" })
  me(@CurrentUser() auth: AuthenticatedRequest["auth"]) {
    return auth;
  }
}

function contextFrom(request: Request): RequestContext {
  return {
    userAgent: request.headers["user-agent"],
    ipAddress: request.ip,
  };
}
