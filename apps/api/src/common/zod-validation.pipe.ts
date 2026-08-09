import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { ErrorCodes } from "@ledgr/contracts";
import type { ZodSchema } from "zod";

/**
 * Validates a request body against a Zod schema from @ledgr/contracts.
 *
 * The same schema validates here and types the web client, so a contract change
 * surfaces as a compile error in the frontend rather than a runtime failure.
 * That is the main argument for the backend being TypeScript at all
 * (docs/adr/0001-backend-language.md), and it only holds if validation actually
 * uses the shared schema instead of a hand-written DTO alongside it.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // Grouped by field so the UI can put each message next to its input
      // rather than dumping a list at the top of the form.
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".") || "_";
        (fieldErrors[path] ??= []).push(issue.message);
      }

      throw new BadRequestException({
        code: ErrorCodes.VALIDATION_FAILED,
        message: "Some fields need attention.",
        fieldErrors,
      });
    }

    return result.data;
  }
}
