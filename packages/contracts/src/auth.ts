import { z } from "zod";

/**
 * Auth contracts.
 *
 * These schemas are the single definition of each request and response shape:
 * the API validates with them, and the web app infers its types from them. A
 * change to a contract becomes a compile error in the frontend rather than a
 * runtime surprise — which is the main reason the backend is TypeScript.
 * See docs/adr/0001-backend-language.md.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email is too long")
  .email("That doesn't look like a valid email address")
  // Stored lowercased; there is no citext column, so normalise on the way in
  // or the same person can register twice with different capitalisation.
  .transform((value) => value.toLowerCase());

/**
 * Password rules.
 *
 * Length is the requirement, deliberately, rather than the usual
 * symbol-and-digit rules. Composition rules push people toward `Password1!`,
 * which is both harder to remember and easier to guess than a long passphrase.
 * 12 characters is the floor; the upper bound exists only to stop a
 * megabyte-long input burning CPU in argon2.
 */
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters — a memorable phrase works well")
  .max(256, "Password is too long");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  /** Names the household created alongside the first user. */
  householdName: z.string().trim().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: applying the 12-character rule at login would reject
  // existing users whose password predates the rule, and leak the policy.
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const householdRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);

export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  householdId: z.string().uuid(),
  householdName: z.string(),
  role: householdRoleSchema,
});

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  /** Access-token lifetime in seconds, so clients can refresh proactively. */
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
});

export const authResponseSchema = z.object({
  user: sessionUserSchema,
  tokens: authTokensSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type HouseholdRole = z.infer<typeof householdRoleSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
