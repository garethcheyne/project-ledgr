import { Module } from "@nestjs/common";
import { MailController } from "./mail.controller.js";
import { MailService } from "./mail.service.js";

@Module({
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
