import { Module } from "@nestjs/common";
import { MailController } from "./mail.controller.js";
import { MailReadController } from "./mail-read.controller.js";
import { MailService } from "./mail.service.js";
import { MailSyncService } from "./mail-sync.service.js";
import { MailReadService } from "./mail-read.service.js";

@Module({
  controllers: [MailController, MailReadController],
  providers: [MailService, MailSyncService, MailReadService],
  exports: [MailService, MailSyncService, MailReadService],
})
export class MailModule {}
