import { supabase } from "@/integrations/supabase/client";
import { authBypassEnabled } from "@/lib/authMode";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.vyva.io";

const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 3500);

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Content-Type")) requestHeaders.set("Content-Type", "application/json");
  requestHeaders.set("ngrok-skip-browser-warning", "true");
  if (!authBypassEnabled && !requestHeaders.has("Authorization")) {
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
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }
    if (res.status === 204) return undefined as T;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) return res.json();

    const text = await res.text();
    return (text ? text : undefined) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
