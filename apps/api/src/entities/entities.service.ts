import { Injectable, NotFoundException } from "@nestjs/common";
import { ErrorCodes } from "@ledgr/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { HouseholdCryptoService } from "../crypto/household-crypto.service.js";

export interface EntitySummary {
  id: string;
  name: string;
  status: string;
  emailDomains: string[];
  messageCount: number;
}

/**
 * Companies and vendors.
 *
 * This is where mail stops being a mail client and becomes a CRM: linking a
 * message to a company is what makes correspondence, cases and bills line up
 * against the same vendor.
 */
@Injectable()
export class EntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HouseholdCryptoService,
  ) {}

  async list(householdId: string, search?: string): Promise<EntitySummary[]> {
    const entities = await this.prisma.client.entity.findMany({
      where: {
        householdId,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { name: "asc" },
      take: 100,
      include: { _count: { select: { messages: true } } },
    });

    return entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      status: entity.status,
      emailDomains: entity.emailDomains,
      messageCount: entity._count.messages,
    }));
  }

  async create(
    householdId: string,
    input: { name: string; emailDomains?: string[] },
  ): Promise<EntitySummary> {
    const entity = await this.prisma.client.entity.create({
      data: {
        householdId,
        name: input.name.trim(),
        emailDomains: normaliseDomains(input.emailDomains ?? []),
      },
    });

    return {
      id: entity.id,
      name: entity.name,
      status: entity.status,
      emailDomains: entity.emailDomains,
      messageCount: 0,
    };
  }

  /**
   * Suggests companies for a sender address.
   *
   * Domain match first — `billing@bunnings.co.nz` and `noreply@bunnings.co.nz`
   * are plainly the same company, and matching on the domain is what stops a
   * vendor accumulating one record per sending address.
   */
  async suggestForAddress(
    householdId: string,
    address: string,
  ): Promise<{ matches: EntitySummary[]; suggestedName: string; domain: string }> {
    const domain = address.split("@")[1]?.toLowerCase() ?? "";

    const byDomain = domain
      ? await this.prisma.client.entity.findMany({
          where: { householdId, emailDomains: { has: domain } },
          include: { _count: { select: { messages: true } } },
          take: 5,
        })
      : [];

    return {
      matches: byDomain.map((entity) => ({
        id: entity.id,
        name: entity.name,
        status: entity.status,
        emailDomains: entity.emailDomains,
        messageCount: entity._count.messages,
      })),
      // "bunnings.co.nz" -> "Bunnings". A reasonable starting point the user
      // can correct, rather than making them type it from scratch.
      suggestedName: suggestNameFromDomain(domain),
      domain,
    };
  }

  /**
   * Links a message to a company.
   *
   * Also links the message's thread, so the whole conversation is attributed
   * rather than one message in the middle of it — and remembers the sender's
   * domain so future mail from that company is recognised automatically.
   */
  async linkMessage(
    householdId: string,
    messageId: string,
    entityId: string | null,
  ): Promise<void> {
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, householdId },
      select: { id: true, mailThreadId: true, fromAddressEnc: true },
    });

    if (!message) {
      throw new NotFoundException({
        code: ErrorCodes.NOT_FOUND,
        message: "That message does not exist.",
      });
    }

    if (entityId) {
      const entity = await this.prisma.client.entity.findFirst({
        where: { id: entityId, householdId },
        select: { id: true, emailDomains: true },
      });

      if (!entity) {
        throw new NotFoundException({
          code: ErrorCodes.NOT_FOUND,
          message: "That company does not exist.",
        });
      }

      const from = await this.crypto.decryptOptional(householdId, message.fromAddressEnc);
      const domain = from?.split("@")[1]?.toLowerCase();

      // Learn the domain so the next message from this company is recognised
      // without the user linking it again.
      if (domain && !entity.emailDomains.includes(domain)) {
        await this.prisma.client.entity.update({
          where: { id: entity.id },
          data: { emailDomains: { push: domain } },
        });
      }
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.message.update({ where: { id: message.id }, data: { entityId } });
      if (message.mailThreadId) {
        await tx.mailThread.update({
          where: { id: message.mailThreadId },
          data: { entityId },
        });
      }
    });
  }

  /**
   * Applies a company's known domains to mail that arrived before the link
   * existed, so linking one message tidies up the back catalogue too.
   */
  async backfillByDomain(householdId: string, entityId: string): Promise<number> {
    const entity = await this.prisma.client.entity.findFirst({
      where: { id: entityId, householdId },
      select: { emailDomains: true },
    });

    if (!entity || entity.emailDomains.length === 0) return 0;

    // fromAddressIdx is an HMAC of the full address, so a domain can't be
    // matched in index space. Decrypting unlinked senders is the honest cost
    // of encrypting them — bounded here to keep it cheap.
    const unlinked = await this.prisma.client.message.findMany({
      where: { householdId, entityId: null },
      select: { id: true, fromAddressEnc: true },
      take: 1000,
    });

    const ids: string[] = [];
    for (const message of unlinked) {
      const from = await this.crypto.decryptOptional(householdId, message.fromAddressEnc);
      const domain = from?.split("@")[1]?.toLowerCase();
      if (domain && entity.emailDomains.includes(domain)) ids.push(message.id);
    }

    if (ids.length === 0) return 0;

    await this.prisma.client.message.updateMany({
      where: { id: { in: ids } },
      data: { entityId },
    });

    return ids.length;
  }
}

function normaliseDomains(domains: string[]): string[] {
  return [...new Set(domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean))];
}

/** "bunnings.co.nz" -> "Bunnings" */
function suggestNameFromDomain(domain: string): string {
  if (!domain) return "";
  const label = domain.split(".")[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
