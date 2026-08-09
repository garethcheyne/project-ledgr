import type { ApiError, AuthResponse, LoginInput, RegisterInput } from "@ledgr/contracts";

/**
 * Client for the Core API.
 *
 * The web app talks to the API over HTTP like any other client and never
 * touches the database — an ESLint rule enforces it. See
 * docs/adr/0002-three-layer-architecture.md.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

/** A failed API call, carrying the structured error the server returned. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }

  /** First message for a field, for rendering next to its input. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors?.[field]?.[0];
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    // fetch only rejects on network failure, so this is genuinely "couldn't
    // reach the server" rather than an error response.
    throw new ApiRequestError(
      0,
      "NETWORK_ERROR",
      "Couldn't reach the server. Check that the API is running.",
    );
  }

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(
      response.status,
      error.code ?? "UNKNOWN",
      error.message ?? "Something went wrong.",
      error.fieldErrors,
    );
  }

  return body as T;
}

export const authApi = {
  register: (input: RegisterInput): Promise<AuthResponse> =>
    request("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  login: (input: LoginInput): Promise<AuthResponse> =>
    request("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  refresh: (refreshToken: string): Promise<AuthResponse> =>
    request("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) }),

  logout: (refreshToken: string): Promise<void> =>
    request("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) }),
};
