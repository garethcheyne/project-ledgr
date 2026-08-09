import { z } from "zod";

/**
 * Every non-2xx response from the Core API has this shape, so clients never
 * have to guess whether a failure carries `message`, `error`, or `errors`.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  /** Stable machine-readable code. Safe to branch on; `message` is not. */
  code: z.string(),
  message: z.string(),
  /** Field-level validation failures, keyed by dotted field path. */
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const ErrorCodes = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_TAKEN: "EMAIL_TAKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  /** A revoked refresh token was replayed — see AuthService for why this
   *  revokes the whole chain rather than just rejecting the request. */
  TOKEN_REUSE_DETECTED: "TOKEN_REUSE_DETECTED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
