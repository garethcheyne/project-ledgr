import type {
  ApiError,
  AuthResponse,
  ConnectionTestResult,
  ImapConnectionInput,
  LoginInput,
  MailAccountSummary,
  MailFolderSummary,
  MessageListItem,
  RegisterInput,
  TestConnectionInput,
} from "@ledgr/contracts";
import { refreshAccessToken } from "./token-refresh";

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

/**
 * Reads the access token directly rather than importing from ./session, which
 * is a client module — this file is also used from places without the React
 * runtime, and the coupling isn't worth it for one localStorage read.
 */
function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("ledgr.accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Endpoints that must never trigger a refresh — refreshing them is circular. */
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeader(),
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

  // Access tokens last 15 minutes. Without this, every page silently breaks
  // once that elapses — which is exactly what happened before it existed.
  // Retried once only: a second 401 means the session is genuinely over, and
  // retrying again would loop.
  if (response.status === 401 && !isRetry && !NO_REFRESH.includes(path)) {
    const token = await refreshAccessToken(API_URL);
    if (token) return request<T>(path, init, true);
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

export const mailApi = {
  listAccounts: (): Promise<MailAccountSummary[]> => request("/mail/accounts"),

  /** Probes credentials without saving, so a wrong app password is caught early. */
  testConnection: (input: TestConnectionInput): Promise<ConnectionTestResult> =>
    request("/mail/accounts/test", { method: "POST", body: JSON.stringify(input) }),

  connect: (input: ImapConnectionInput): Promise<MailAccountSummary> =>
    request("/mail/accounts", { method: "POST", body: JSON.stringify(input) }),

  disconnect: (id: string): Promise<void> => request(`/mail/accounts/${id}`, { method: "DELETE" }),

  /** Pulls folders and new messages. Safe to re-run — it continues from a cursor. */
  sync: (id: string): Promise<SyncResult> =>
    request(`/mail/accounts/${id}/sync`, { method: "POST" }),

  folders: (accountId?: string): Promise<MailFolderSummary[]> =>
    request(`/mail/folders${accountId ? `?accountId=${accountId}` : ""}`),

  messages: (params: { folderId?: string; limit?: number } = {}): Promise<MessageListItem[]> => {
    const query = new URLSearchParams();
    if (params.folderId) query.set("folderId", params.folderId);
    if (params.limit) query.set("limit", String(params.limit));
    const suffix = query.toString();
    return request(`/mail/messages${suffix ? `?${suffix}` : ""}`);
  },

  message: (id: string): Promise<MessageDetail> => request(`/mail/messages/${id}`),

  markRead: (id: string, read: boolean): Promise<void> =>
    request(`/mail/messages/${id}/read`, { method: "PATCH", body: JSON.stringify({ read }) }),

  setStarred: (id: string, starred: boolean): Promise<void> =>
    request(`/mail/messages/${id}/starred`, {
      method: "PATCH",
      body: JSON.stringify({ starred }),
    }),
};

/** Mirrors SyncResult in the API. */
export interface SyncResult {
  foldersDiscovered: number;
  foldersSynced: number;
  messagesStored: number;
  hasMore: boolean;
  errors: string[];
}

/** Mirrors MessageDetail in the API. */
export interface MessageDetail extends MessageListItem {
  bodyText: string | null;
  bodyHtml: string | null;
  to: { name: string; address: string }[];
  cc: { name: string; address: string }[];
  folderId: string | null;
  entityId: string | null;
  entityName: string | null;
}

export interface EntitySummary {
  id: string;
  name: string;
  status: string;
  emailDomains: string[];
  messageCount: number;
}

export const entitiesApi = {
  list: (search?: string): Promise<EntitySummary[]> =>
    request(`/entities${search ? `?search=${encodeURIComponent(search)}` : ""}`),

  create: (input: { name: string; emailDomains?: string[] }): Promise<EntitySummary> =>
    request("/entities", { method: "POST", body: JSON.stringify(input) }),

  suggest: (
    address: string,
  ): Promise<{ matches: EntitySummary[]; suggestedName: string; domain: string }> =>
    request(`/entities/suggest?address=${encodeURIComponent(address)}`),

  /** Attributes existing mail from this company's known domains. */
  backfill: (id: string): Promise<{ linked: number }> =>
    request(`/entities/${id}/backfill`, { method: "POST" }),

  linkMessage: (messageId: string, entityId: string | null): Promise<void> =>
    request(`/mail/messages/${messageId}/entity`, {
      method: "PATCH",
      body: JSON.stringify({ entityId }),
    }),
};

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
