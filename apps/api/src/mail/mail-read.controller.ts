import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { MailFolderSummary, MessageListItem } from "@ledgr/contracts";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedRequest } from "../auth/jwt-auth.guard.js";
import { MailReadService, type MessageDetail } from "./mail-read.service.js";

@ApiTags("mail")
@Controller("mail")
export class MailReadController {
  constructor(private readonly read: MailReadService) {}

  @Get("folders")
  @ApiOperation({ summary: "Folders for the current household" })
  folders(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Query("accountId") accountId?: string,
  ): Promise<MailFolderSummary[]> {
    return this.read.listFolders(auth.householdId, accountId);
  }

  @Get("messages")
  @ApiOperation({ summary: "Messages, newest first" })
  messages(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Query("folderId") folderId?: string,
    @Query("limit") limit?: string,
    @Query("before") before?: string,
  ): Promise<MessageListItem[]> {
    return this.read.listMessages(auth.householdId, {
      folderId,
      limit: limit ? Number(limit) : undefined,
      before: before ? new Date(before) : undefined,
    });
  }

  @Get("messages/:id")
  @ApiOperation({ summary: "One message, with body" })
  message(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Param("id") id: string,
  ): Promise<MessageDetail> {
    return this.read.getMessage(auth.householdId, id);
  }

  @Patch("messages/:id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark a message read or unread" })
  async markRead(
    @CurrentUser() auth: AuthenticatedRequest["auth"],
    @Param("id") id: string,
    @Body() body: { read?: boolean },
  ): Promise<void> {
    await this.read.markRead(auth.householdId, id, body.read !== false);
  }
}
