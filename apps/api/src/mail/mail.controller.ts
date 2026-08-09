import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  imapConnectionSchema,
  testConnectionSchema,
  type ConnectionTestResult,
  type ImapConnectionInput,
  type MailAccountSummary,
  type TestConnectionInput,
} from "@ledgr/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import { MailService } from "./mail.service.js";

@ApiTags("mail")
@Controller("mail/accounts")
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get()
  @ApiOperation({ summary: "Mail accounts for the current household" })
  list(@CurrentUser() auth: AuthenticatedRequest["auth"]): Promise<MailAccountSummary[]> {
    return this.mail.listAccounts(auth.householdId);
  }

  @Post("test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Probe IMAP and SMTP credentials without saving" })
  test(
    @Body(new ZodValidationPipe(testConnectionSchema)) body: TestConnectionInput,
  ): Promise<ConnectionTestResult> {
    return this.mail.testConnection(body);
  }

  @Post()
  @ApiOperation({ summary: "Connect an IMAP mailbox" })
  connect(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Body(new ZodValidationPipe(imapConnectionSchema)) body: ImapConnectionInput,
  ): Promise<MailAccountSummary> {
    return this.mail.connectImap(auth.householdId, auth.userId, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect a mailbox" })
  async remove(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Param("id") id: string,
  ): Promise<void> {
    await this.mail.deleteAccount(auth.householdId, id);
  }
}
