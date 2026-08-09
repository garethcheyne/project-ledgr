"use client";

import type { AuthResponse } from "@ledgr/contracts";

/**
 * Single-flight access-token refresh.
 *
 * ⚠️ The single-flight part is load-bearing, not an optimisation.
 *
 * Refresh tokens are single-use, and the API treats a *reused* one as evidence
 * of theft: it revokes the entire token chain and signs the user out
 * everywhere. So if two requests 401 at the same time and both refresh with the
 * same stored token, the second is indistinguishable from an attacker replaying
 * a stolen token — and the user gets kicked out for doing nothing wrong.
 *
 * A page like the dashboard fires several requests at once, so this is the
 * common case, not an edge case. Every caller therefore awaits the same
 * in-flight refresh.
 *
 * See AuthService.refresh in the API for the other half of this.
 */

const ACCESS_KEY = "ledgr.accessToken";
const REFRESH_KEY = "ledgr.refreshToken";
const USER_KEY = "ledgr.user";

let inFlight: Promise<string | null> | null = null;

async function performRefresh(apiUrl: string): Promise<string | null> {
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // The refresh token is expired, revoked, or the chain was invalidated.
    // Clear everything so the app shows a sign-in prompt rather than looping.
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
    window.localStorage.removeItem(USER_KEY);
    return null;
  }

  const auth = (await response.json()) as AuthResponse;

  // Store the rotated pair. Missing this would leave the old refresh token in
  // place, and using it again would trip reuse detection on the next refresh.
  window.localStorage.setItem(ACCESS_KEY, auth.tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, auth.tokens.refreshToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));

  return auth.tokens.accessToken;
}

/**
 * Returns a fresh access token, or null when the session is truly over.
 * Concurrent callers share one refresh.
 */
export async function refreshAccessToken(apiUrl: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  inFlight ??= performRefresh(apiUrl).finally(() => {
    // Cleared only after settling, so the next 401 starts a new refresh rather
    // than resolving against a stale result.
    inFlight = null;
  });

  return inFlight;
}
