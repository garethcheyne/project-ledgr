import { Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "./auth/auth.module.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { HttpExceptionFilter } from "./common/http-exception.filter.js";
import { ENV, loadEnv, type Env } from "./config/env.js";
import { HouseholdCryptoService } from "./crypto/household-crypto.service.js";
import { EntitiesModule } from "./entities/entities.module.js";
import { HealthModule } from "./health/health.module.js";
import { MailModule } from "./mail/mail.module.js";
import { PrismaService } from "./prisma/prisma.service.js";

/**
 * Config, database and crypto are global: nearly every feature module needs
 * them, and importing three modules into each one is noise that adds nothing.
 */
@Global()
@Module({
  // JwtModule lives here rather than in AuthModule because the global
  // JwtAuthGuard is registered on AppModule and needs JwtService injectable
  // there too. Secrets are still passed per sign/verify call, never configured
  // on the module, so the access and refresh secrets can't be confused.
  imports: [JwtModule.register({})],
  providers: [
    { provide: ENV, useFactory: (): Env => loadEnv() },
    PrismaService,
    HouseholdCryptoService,
  ],
  exports: [ENV, JwtModule, PrismaService, HouseholdCryptoService],
})
export class CoreModule {}

@Module({
  imports: [CoreModule, AuthModule, EntitiesModule, HealthModule, MailModule],
  providers: [
    // Authenticate by default; @Public() is the explicit opt-out. The reverse
    // makes an unguarded endpoint the silent result of a forgotten decorator.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
