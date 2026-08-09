import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  blindIndex,
  decryptToString,
  encrypt,
  generateKey,
  loadMasterKey,
  termHash,
  unwrapKey,
  wrapKey,
  type Key,
} from "@ledgr/crypto";
import { ENV, type Env } from "../config/env.js";
import type { PrismaTransactionClient } from "@ledgr/db";
import { PrismaService } from "../prisma/prisma.service.js";

interface HouseholdKeys {
  dataKey: Key;
  indexKey: Key;
  version: number;
}

/**
 * Resolves per-household encryption keys and applies them.
 *
 * See docs/adr/0006-encryption-at-rest.md. Callers never touch raw keys — they
 * ask this service to encrypt or decrypt for a household, so it is not possible
 * to forget encryption at an individual call site.
 */
@Injectable()
export class HouseholdCryptoService implements OnModuleInit {
  private readonly logger = new Logger(HouseholdCryptoService.name);
  private readonly masterKey: Key;

  /**
   * Unwrapped keys, cached per household.
   *
   * These are plaintext key material in process memory. That is inherent to
   * the design — the server must decrypt to sync mail and run OCR — and it is
   * why ADR 0006 states plainly that column encryption does not defend against
   * a compromised API process.
   */
  private readonly cache = new Map<string, HouseholdKeys>();

  constructor(
    @Inject(ENV) env: Env,
    private readonly prisma: PrismaService,
  ) {
    // Throws if unset or the wrong length. Deliberately fatal: a deployment
    // that quietly stopped encrypting is worse than one that won't start.
    this.masterKey = loadMasterKey({
      LEDGR_ENCRYPTION_KEY: env.LEDGR_ENCRYPTION_KEY,
    } as NodeJS.ProcessEnv);
  }

  onModuleInit(): void {
    this.logger.log("Encryption at rest enabled (AES-256-GCM, envelope keys)");
  }

  /** Creates the initial data and index keys for a new household. */
  async createKeysFor(householdId: string, tx?: PrismaTransactionClient): Promise<void> {
    const db = tx ?? this.prisma.client;
    const dataKey = generateKey();
    const indexKey = generateKey();

    await db.householdDataKey.create({
      data: {
        householdId,
        version: 1,
        kekVersion: 1,
        wrappedKey: wrapKey(dataKey, this.masterKey, 1),
        wrappedIndexKey: wrapKey(indexKey, this.masterKey, 1),
        isActive: true,
      },
    });

    this.cache.set(householdId, { dataKey, indexKey, version: 1 });
  }

  private async keysFor(householdId: string): Promise<HouseholdKeys> {
    const cached = this.cache.get(householdId);
    if (cached) return cached;

    const record = await this.prisma.client.householdDataKey.findFirst({
      where: { householdId, isActive: true },
      orderBy: { version: "desc" },
    });

    if (!record) {
      throw new Error(
        `No active encryption key for household ${householdId}. ` +
          "This household's data cannot be read or written. If this follows a " +
          "restore, the LEDGR_ENCRYPTION_KEY probably does not match the one " +
          "used when the backup was taken.",
      );
    }

    const keys: HouseholdKeys = {
      dataKey: unwrapKey(Buffer.from(record.wrappedKey), this.masterKey),
      indexKey: unwrapKey(Buffer.from(record.wrappedIndexKey), this.masterKey),
      version: record.version,
    };

    this.cache.set(householdId, keys);
    return keys;
  }

  /**
   * Encrypts a value for a household.
   *
   * `aad` should identify the row — passing it means a ciphertext copied to a
   * different row fails to decrypt rather than silently succeeding.
   */
  async encryptFor(householdId: string, plaintext: string, aad?: string): Promise<Buffer> {
    const { dataKey, version } = await this.keysFor(householdId);
    return encrypt(plaintext, dataKey, version, aad);
  }

  async decryptFor(householdId: string, payload: Buffer, aad?: string): Promise<string> {
    const { dataKey } = await this.keysFor(householdId);
    return decryptToString(payload, dataKey, aad);
  }

  /** Null-tolerant, since most encrypted columns are optional. */
  async decryptOptional(
    householdId: string,
    payload: Uint8Array | null | undefined,
    aad?: string,
  ): Promise<string | null> {
    if (!payload) return null;
    return this.decryptFor(householdId, Buffer.from(payload), aad);
  }

  /** Deterministic HMAC for exact-match lookup over an encrypted column. */
  async blindIndexFor(householdId: string, value: string): Promise<string> {
    const { indexKey } = await this.keysFor(householdId);
    return blindIndex(value, indexKey);
  }

  /** Hashes search tokens for the message search-term table. */
  async termHashesFor(householdId: string, tokens: string[]): Promise<Buffer[]> {
    const { indexKey } = await this.keysFor(householdId);
    return tokens.map((token) => termHash(token, indexKey));
  }

  /** Current key version, for stamping the `keyVersion` column on writes. */
  async keyVersionFor(householdId: string): Promise<number> {
    return (await this.keysFor(householdId)).version;
  }

  /** Drops cached key material — call after rotation. */
  evict(householdId?: string): void {
    if (householdId) this.cache.delete(householdId);
    else this.cache.clear();
  }
}
