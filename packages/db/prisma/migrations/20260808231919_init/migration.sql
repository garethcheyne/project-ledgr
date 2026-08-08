-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GOOGLE', 'MICROSOFT', 'IMAP');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'CONNECTED', 'SYNCING', 'ERROR', 'REAUTH_REQUIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FolderRole" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'TRASH', 'SPAM', 'ARCHIVE', 'STARRED', 'IMPORTANT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SearchField" AS ENUM ('SUBJECT', 'BODY', 'PARTICIPANT');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'AWAITING_FILE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'AWAITING_VENDOR', 'AWAITING_US', 'RESOLVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('PHONE_CALL', 'SMS', 'LETTER', 'MEETING', 'NOTE', 'CHAT');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AttachmentTag" AS ENUM ('RECEIPT', 'INVOICE', 'CONTRACT', 'STATEMENT', 'CORRESPONDENCE', 'WARRANTY', 'OTHER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SWITCHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL', 'IRREGULAR', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PAID', 'OVERDUE', 'DISPUTED', 'VOID');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('QUEUED', 'RUNNING_OCR', 'RUNNING_EXTRACTION', 'PENDING_REVIEW', 'CONFIRMED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'NZD',
    "timezone" TEXT NOT NULL DEFAULT 'Pacific/Auckland',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "HouseholdRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_data_keys" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "wrappedKey" BYTEA NOT NULL,
    "kekVersion" INTEGER NOT NULL DEFAULT 1,
    "wrappedIndexKey" BYTEA NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "household_data_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "replacedById" UUID,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_access_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_accounts" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "MailProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "accessTokenEnc" BYTEA,
    "refreshTokenEnc" BYTEA,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerAccountId" TEXT,
    "imapHost" TEXT,
    "imapPort" INTEGER,
    "imapUseTls" BOOLEAN NOT NULL DEFAULT true,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpUseTls" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT,
    "passwordEnc" BYTEA,
    "supportsIdle" BOOLEAN NOT NULL DEFAULT true,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "syncCursor" TEXT,
    "pushSubscriptionId" TEXT,
    "pushExpiresAt" TIMESTAMP(3),
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_folders" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "providerFolderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "FolderRole" NOT NULL DEFAULT 'CUSTOM',
    "parentId" UUID,
    "uidValidity" BIGINT,
    "lastSeenUid" BIGINT,
    "syncCursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mail_threads" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT false,
    "subjectEnc" BYTEA,
    "subjectIdx" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,
    "participantsEnc" BYTEA,
    "entityId" UUID,
    "caseId" UUID,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "folderId" UUID,
    "mailThreadId" UUID,
    "providerMessageId" TEXT NOT NULL,
    "uid" BIGINT,
    "messageIdHeader" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subjectEnc" BYTEA,
    "bodyTextEnc" BYTEA,
    "bodyHtmlEnc" BYTEA,
    "snippetEnc" BYTEA,
    "fromAddressEnc" BYTEA,
    "fromAddressIdx" TEXT,
    "fromNameEnc" BYTEA,
    "toEnc" BYTEA,
    "ccEnc" BYTEA,
    "bccEnc" BYTEA,
    "replyToEnc" BYTEA,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" INTEGER,
    "providerLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entityId" UUID,
    "caseId" UUID,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_search_terms" (
    "messageId" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "termHash" BYTEA NOT NULL,
    "field" "SearchField" NOT NULL DEFAULT 'BODY',

    CONSTRAINT "message_search_terms_pkey" PRIMARY KEY ("messageId","termHash","field")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "folderId" UUID,
    "providerDraftId" TEXT,
    "inReplyToMessageId" UUID,
    "forwardOfMessageId" UUID,
    "mailThreadId" UUID,
    "subjectEnc" BYTEA,
    "bodyTextEnc" BYTEA,
    "bodyHtmlEnc" BYTEA,
    "toEnc" BYTEA,
    "ccEnc" BYTEA,
    "bccEnc" BYTEA,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawMimeEnc" BYTEA,
    "subjectEnc" BYTEA,
    "toEnc" BYTEA,
    "providerMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentCopyFiled" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "accountRef" TEXT,
    "notesEnc" BYTEA,
    "metadata" JSONB,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "entityId" UUID,
    "title" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "summaryEnc" BYTEA,
    "followUpAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "entityId" UUID,
    "caseId" UUID,
    "type" "CommunicationType" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'INTERNAL',
    "subjectEnc" BYTEA,
    "bodyEnc" BYTEA,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "durationMins" INTEGER,
    "metadata" JSONB,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "contentId" TEXT,
    "isInline" BOOLEAN NOT NULL DEFAULT false,
    "tag" "AttachmentTag" NOT NULL DEFAULT 'OTHER',
    "messageId" UUID,
    "draftId" UUID,
    "communicationId" UUID,
    "billId" UUID,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "parentId" UUID,
    "isEssential" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expectedAmount" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'NZD',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "billingDay" INTEGER,
    "accountNumber" TEXT,
    "planName" TEXT,
    "contractEndsAt" DATE,
    "noticePeriodDays" INTEGER,
    "endReason" TEXT,
    "notesEnc" BYTEA,
    "metadata" JSONB,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "periodStart" DATE,
    "periodEnd" DATE,
    "amount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'NZD',
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "extractionJobId" UUID,
    "notesEnc" BYTEA,
    "metadata" JSONB,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_jobs" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "attachmentId" UUID NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'QUEUED',
    "ocrTextEnc" BYTEA,
    "ocrConfidence" DOUBLE PRECISION,
    "extractedEnc" BYTEA,
    "confidence" DOUBLE PRECISION,
    "model" TEXT,
    "suggestedEntityId" UUID,
    "suggestedCategoryId" UUID,
    "entityMatchScore" DOUBLE PRECISION,
    "rawVendorName" TEXT,
    "errorMessage" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "household_members_userId_idx" ON "household_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_householdId_userId_key" ON "household_members"("householdId", "userId");

-- CreateIndex
CREATE INDEX "household_data_keys_householdId_isActive_idx" ON "household_data_keys"("householdId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "household_data_keys_householdId_version_key" ON "household_data_keys"("householdId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_tokenHash_key" ON "personal_access_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "personal_access_tokens_userId_idx" ON "personal_access_tokens"("userId");

-- CreateIndex
CREATE INDEX "mail_accounts_householdId_idx" ON "mail_accounts"("householdId");

-- CreateIndex
CREATE INDEX "mail_accounts_userId_idx" ON "mail_accounts"("userId");

-- CreateIndex
CREATE INDEX "mail_accounts_status_idx" ON "mail_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mail_accounts_householdId_provider_emailAddress_key" ON "mail_accounts"("householdId", "provider", "emailAddress");

-- CreateIndex
CREATE INDEX "mail_folders_householdId_idx" ON "mail_folders"("householdId");

-- CreateIndex
CREATE INDEX "mail_folders_mailAccountId_role_idx" ON "mail_folders"("mailAccountId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "mail_folders_mailAccountId_providerFolderId_key" ON "mail_folders"("mailAccountId", "providerFolderId");

-- CreateIndex
CREATE INDEX "mail_threads_householdId_lastMessageAt_idx" ON "mail_threads"("householdId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "mail_threads_entityId_idx" ON "mail_threads"("entityId");

-- CreateIndex
CREATE INDEX "mail_threads_caseId_idx" ON "mail_threads"("caseId");

-- CreateIndex
CREATE INDEX "mail_threads_subjectIdx_idx" ON "mail_threads"("subjectIdx");

-- CreateIndex
CREATE UNIQUE INDEX "mail_threads_mailAccountId_providerThreadId_key" ON "mail_threads"("mailAccountId", "providerThreadId");

-- CreateIndex
CREATE INDEX "messages_householdId_receivedAt_idx" ON "messages"("householdId", "receivedAt");

-- CreateIndex
CREATE INDEX "messages_mailThreadId_sentAt_idx" ON "messages"("mailThreadId", "sentAt");

-- CreateIndex
CREATE INDEX "messages_folderId_receivedAt_idx" ON "messages"("folderId", "receivedAt");

-- CreateIndex
CREATE INDEX "messages_householdId_isRead_idx" ON "messages"("householdId", "isRead");

-- CreateIndex
CREATE INDEX "messages_fromAddressIdx_idx" ON "messages"("fromAddressIdx");

-- CreateIndex
CREATE INDEX "messages_entityId_idx" ON "messages"("entityId");

-- CreateIndex
CREATE INDEX "messages_caseId_idx" ON "messages"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_mailAccountId_providerMessageId_key" ON "messages"("mailAccountId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "messages_mailAccountId_messageIdHeader_key" ON "messages"("mailAccountId", "messageIdHeader");

-- CreateIndex
CREATE INDEX "message_search_terms_householdId_termHash_idx" ON "message_search_terms"("householdId", "termHash");

-- CreateIndex
CREATE INDEX "drafts_householdId_updatedAt_idx" ON "drafts"("householdId", "updatedAt");

-- CreateIndex
CREATE INDEX "drafts_mailAccountId_idx" ON "drafts"("mailAccountId");

-- CreateIndex
CREATE INDEX "outbound_messages_householdId_idx" ON "outbound_messages"("householdId");

-- CreateIndex
CREATE INDEX "outbound_messages_status_sendAfter_idx" ON "outbound_messages"("status", "sendAfter");

-- CreateIndex
CREATE INDEX "entities_householdId_idx" ON "entities"("householdId");

-- CreateIndex
CREATE INDEX "entities_householdId_status_idx" ON "entities"("householdId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "entities_householdId_name_key" ON "entities"("householdId", "name");

-- CreateIndex
CREATE INDEX "cases_householdId_idx" ON "cases"("householdId");

-- CreateIndex
CREATE INDEX "cases_householdId_status_idx" ON "cases"("householdId", "status");

-- CreateIndex
CREATE INDEX "cases_entityId_idx" ON "cases"("entityId");

-- CreateIndex
CREATE INDEX "communications_householdId_occurredAt_idx" ON "communications"("householdId", "occurredAt");

-- CreateIndex
CREATE INDEX "communications_entityId_occurredAt_idx" ON "communications"("entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "communications_caseId_idx" ON "communications"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storageKey_key" ON "attachments"("storageKey");

-- CreateIndex
CREATE INDEX "attachments_householdId_idx" ON "attachments"("householdId");

-- CreateIndex
CREATE INDEX "attachments_householdId_tag_idx" ON "attachments"("householdId", "tag");

-- CreateIndex
CREATE INDEX "attachments_messageId_idx" ON "attachments"("messageId");

-- CreateIndex
CREATE INDEX "attachments_draftId_idx" ON "attachments"("draftId");

-- CreateIndex
CREATE INDEX "attachments_billId_idx" ON "attachments"("billId");

-- CreateIndex
CREATE INDEX "attachments_householdId_checksum_idx" ON "attachments"("householdId", "checksum");

-- CreateIndex
CREATE INDEX "categories_householdId_idx" ON "categories"("householdId");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_name_key" ON "categories"("householdId", "name");

-- CreateIndex
CREATE INDEX "subscriptions_householdId_idx" ON "subscriptions"("householdId");

-- CreateIndex
CREATE INDEX "subscriptions_householdId_categoryId_startDate_idx" ON "subscriptions"("householdId", "categoryId", "startDate");

-- CreateIndex
CREATE INDEX "subscriptions_householdId_entityId_idx" ON "subscriptions"("householdId", "entityId");

-- CreateIndex
CREATE INDEX "subscriptions_categoryId_startDate_endDate_idx" ON "subscriptions"("categoryId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "bills_extractionJobId_key" ON "bills"("extractionJobId");

-- CreateIndex
CREATE INDEX "bills_householdId_idx" ON "bills"("householdId");

-- CreateIndex
CREATE INDEX "bills_householdId_issueDate_idx" ON "bills"("householdId", "issueDate");

-- CreateIndex
CREATE INDEX "bills_subscriptionId_issueDate_idx" ON "bills"("subscriptionId", "issueDate");

-- CreateIndex
CREATE INDEX "bills_householdId_status_idx" ON "bills"("householdId", "status");

-- CreateIndex
CREATE INDEX "extraction_jobs_householdId_idx" ON "extraction_jobs"("householdId");

-- CreateIndex
CREATE INDEX "extraction_jobs_householdId_status_idx" ON "extraction_jobs"("householdId", "status");

-- CreateIndex
CREATE INDEX "extraction_jobs_attachmentId_idx" ON "extraction_jobs"("attachmentId");

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_data_keys" ADD CONSTRAINT "household_data_keys_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_accounts" ADD CONSTRAINT "mail_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_folders" ADD CONSTRAINT "mail_folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "mail_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_folders" ADD CONSTRAINT "mail_folders_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_folders" ADD CONSTRAINT "mail_folders_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_threads" ADD CONSTRAINT "mail_threads_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_threads" ADD CONSTRAINT "mail_threads_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_threads" ADD CONSTRAINT "mail_threads_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mail_threads" ADD CONSTRAINT "mail_threads_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "mail_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mailThreadId_fkey" FOREIGN KEY ("mailThreadId") REFERENCES "mail_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_search_terms" ADD CONSTRAINT "message_search_terms_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "mail_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "mail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "communications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_extractionJobId_fkey" FOREIGN KEY ("extractionJobId") REFERENCES "extraction_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_suggestedEntityId_fkey" FOREIGN KEY ("suggestedEntityId") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_jobs" ADD CONSTRAINT "extraction_jobs_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
