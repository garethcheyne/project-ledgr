import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { ENV, type Env } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const env = app.get<Env>(ENV);

  app.use(helmet());

  // The web app is a separate origin, so CORS is required rather than
  // incidental. Origins are an explicit allowlist — never a wildcard, since
  // credentials travel on these requests.
  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Versioned from the first release. Retrofitting a version prefix once
  // clients exist means either breaking them or serving two path shapes.
  app.setGlobalPrefix("api/v1");

  if (!env.isProduction) {
    const config = new DocumentBuilder()
      .setTitle("Ledgr Core API")
      .setDescription("Personal CRM: mail, vendors, and household finances.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config));
    logger.log(`API docs: http://localhost:${env.API_PORT}/api/docs`);
  }

  app.enableShutdownHooks();

  await app.listen(env.API_PORT, "0.0.0.0");

  logger.log(`Ledgr API listening on port ${env.API_PORT}`);
  logger.log(
    `Mail providers — Google: ${env.googleOAuthConfigured ? "configured" : "not configured"}, Microsoft: ${env.microsoftOAuthConfigured ? "configured" : "not configured"}, IMAP: always available`,
  );
}

bootstrap().catch((error: unknown) => {
  // Config and key errors land here. Print the message plainly — it names the
  // variable that needs fixing, and a stack trace buries it.
  const logger = new Logger("Bootstrap");
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
