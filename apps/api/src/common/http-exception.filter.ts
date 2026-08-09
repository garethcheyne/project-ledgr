import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { ErrorCodes, type ApiError } from "@ledgr/contracts";
import type { Request, Response } from "express";

/**
 * Normalises every error into the ApiError shape from @ledgr/contracts, so
 * clients never have to guess whether a failure carries `message`, `error`, or
 * `errors`.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCodes.INTERNAL;
    let message = "Something went wrong on our end.";
    let fieldErrors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "object" && body !== null) {
        const payload = body as Record<string, unknown>;
        if (typeof payload.code === "string") code = payload.code;
        if (typeof payload.message === "string") message = payload.message;
        if (payload.fieldErrors && typeof payload.fieldErrors === "object") {
          fieldErrors = payload.fieldErrors as Record<string, string[]>;
        }
      } else if (typeof body === "string") {
        message = body;
      }
    } else {
      // Unexpected: log the real error server-side, return nothing revealing.
      // Stack traces and driver messages leak schema and file paths.
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const payload: ApiError = { statusCode: status, code, message, fieldErrors };
    response.status(status).json(payload);
  }
}
