import type { Session, User } from "@supabase/supabase-js";

export const BACKEND_SESSION_STORAGE_KEY = "vyva-console-session";

type StoredBackendSession = {
  accessToken: string;
  expiresAt: number | null;
  user: User;
};

export function getBackendSessionToken() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKEND_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredBackendSession;
    if (!stored.accessToken) return null;
    if (stored.expiresAt && stored.expiresAt * 1000 <= Date.now()) {
      clearBackendSession();
      return null;
    }
    return stored.accessToken;
  } catch {
    clearBackendSession();
    return null;
  }
}

export function getBackendSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKEND_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredBackendSession;
    if (!stored.accessToken || !stored.user?.id) return null;
    if (stored.expiresAt && stored.expiresAt * 1000 <= Date.now()) {
      clearBackendSession();
      return null;
    }

    return {
      access_token: stored.accessToken,
      token_type: "bearer",
      expires_at: stored.expiresAt ?? undefined,
      expires_in: stored.expiresAt ? Math.max(0, stored.expiresAt - Math.floor(Date.now() / 1000)) : 0,
      refresh_token: "",
      user: stored.user,
    } as Session;
  } catch {
    clearBackendSession();
    return null;
  }
}

export function setBackendSession(session: Session) {
  if (typeof window === "undefined") return;
  const stored: StoredBackendSession = {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    user: session.user,
  };
  window.localStorage.setItem(BACKEND_SESSION_STORAGE_KEY, JSON.stringify(stored));
}

export function clearBackendSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BACKEND_SESSION_STORAGE_KEY);
}
