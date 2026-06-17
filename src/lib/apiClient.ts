import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { authBypassEnabled } from "@/lib/authMode";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
export const ACTIVE_ORGANIZATION_STORAGE_KEY = "active-organization-id";

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 3500);

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

async function responseErrorMessage(res: Response) {
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;
  return typeof body?.error === "string" || typeof body?.message === "string"
    ? body.error || body.message
    : `API error ${res.status}: ${res.statusText}`;
}

async function parseApiResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();

  const text = await res.text();
  return (text ? text : undefined) as T;
}

function isSessionAuthError(status: number, message: string) {
  return status === 401 && /invalid session|authentication required|jwt|token/i.test(message);
}

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  requestHeaders.set("ngrok-skip-browser-warning", "true");
  const activeOrganizationId = localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  if (activeOrganizationId && !requestHeaders.has("x-organization-id")) {
    requestHeaders.set("x-organization-id", activeOrganizationId);
  }
  const canAttachSupabaseAuth = !authBypassEnabled && supabaseConfigured && !requestHeaders.has("Authorization");
  if (canAttachSupabaseAuth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const timeoutId = signal ? undefined : setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...fetchOptions,
      headers: requestHeaders,
      signal: signal ?? controller.signal,
    });
    if (!res.ok) {
      const message = await responseErrorMessage(res);
      if (canAttachSupabaseAuth && isSessionAuthError(res.status, message)) {
        const { data } = await supabase.auth.refreshSession();
        const refreshedToken = data.session?.access_token;
        if (refreshedToken) {
          requestHeaders.set("Authorization", `Bearer ${refreshedToken}`);
          const retryRes = await fetch(`${BASE_URL}${path}`, {
            ...fetchOptions,
            headers: requestHeaders,
            signal: signal ?? controller.signal,
          });
          if (retryRes.ok) return parseApiResponse<T>(retryRes);
          throw new Error(await responseErrorMessage(retryRes));
        }
      }
      throw new Error(message);
    }
    return parseApiResponse<T>(res);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
