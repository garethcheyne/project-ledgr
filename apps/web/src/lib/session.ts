"use client";

import type { AuthResponse, SessionUser } from "@ledgr/contracts";

/**
 * Client-side session storage.
 *
 * Tokens live in localStorage, which is readable by any script on the origin —
 * so this trades XSS resistance for the ability to serve any client (mobile,
 * CLI) from the same token-based API. A same-site httpOnly cookie would be
 * safer for the browser specifically, but would not work for the non-browser
 * clients ADR 0002 exists to keep possible.
 *
 * The mitigation is a short access-token lifetime (15 minutes) plus refresh
 * rotation with reuse detection, so a stolen token has a small window and a
 * stolen refresh token is detected the moment the real client next refreshes.
 */

const ACCESS_KEY = "ledgr.accessToken";
const REFRESH_KEY = "ledgr.refreshToken";
const USER_KEY = "ledgr.user";

export function saveSession(auth: AuthResponse): void {
  localStorage.setItem(ACCESS_KEY, auth.tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, auth.tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    // Corrupt or from an older shape — treat as signed out rather than
    // crashing the whole app on a bad localStorage value.
    clearSession();
    return null;
  }
}
