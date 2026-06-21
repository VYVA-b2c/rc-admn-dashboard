import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { AUTH_SESSION_EXPIRED_EVENT, BASE_URL } from "@/lib/apiClient";
import { clearBackendSession, getBackendSession, setBackendSession } from "@/lib/backendSession";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string, redirectPath?: string) => Promise<{ error: Error | null; delayed?: boolean }>;
  signInWithConsoleToken: (token: string) => Promise<{ error: Error | null; next?: string }>;
  signInWithOAuth: (provider: "google" | "azure", redirectPath?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_RESTORE_TIMEOUT_MS = 6000;
const AUTH_CALLBACK_RETRY_DELAY_MS = 250;

function safeRedirectPath(path = "/") {
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

function authRedirectUrl(path?: string) {
  return `${window.location.origin}${safeRedirectPath(path)}`;
}

function hasPendingAuthCallback() {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    url.searchParams.has("type") ||
    hashParams.has("access_token") ||
    hashParams.has("refresh_token") ||
    hashParams.has("type")
  );
}

async function clearLocalSession() {
  clearBackendSession();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignore cleanup failures during auth recovery.
  }
}

async function withAuthTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Auth restore timed out")), AUTH_RESTORE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const applySession = (s: Session | null) => {
      setSession(s);
      setUser(s?.user ?? null);
    };

    const finalizeSignedOutState = async () => {
      await clearLocalSession();
      applySession(null);
      setLoading(false);
    };

    const validateSession = async (candidate: Session | null) => {
      if (!candidate?.access_token) return null;
      const { data, error } = await withAuthTimeout(supabase.auth.getUser(candidate.access_token)).catch(() => ({
        data: { user: null },
        error: new Error("Auth user validation timed out"),
      }));
      if (error || !data.user) return null;
      return {
        ...candidate,
        user: data.user,
      } satisfies Session;
    };

    const restoreBackendSession = async () => {
      const backendSession = getBackendSession();
      if (!backendSession?.access_token) return false;

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), AUTH_RESTORE_TIMEOUT_MS);
      const response = await fetch(`${BASE_URL}/api/v1/me`, {
        headers: {
          Authorization: `Bearer ${backendSession.access_token}`,
          "ngrok-skip-browser-warning": "true",
        },
        signal: controller.signal,
      }).catch(() => null).finally(() => {
        window.clearTimeout(timeoutId);
      });

      if (!response?.ok) {
        clearBackendSession();
        return false;
      }

      applySession(backendSession);
      setLoading(false);
      return true;
    };

    if (!supabaseConfigured) {
      void restoreBackendSession().then((restored) => {
        if (!restored) {
          applySession(null);
          setLoading(false);
        }
      });
      return;
    }

    // Listen first, then restore
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESH_FAILED") {
        void finalizeSignedOutState();
        return;
      }
      applySession(s);
      setLoading(false);
    });

    const restoreSession = async () => {
      if (await restoreBackendSession()) return;

      const pendingCallback = hasPendingAuthCallback();
      const attempts = pendingCallback ? 8 : 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const sessionResult = await withAuthTimeout(supabase.auth.getSession()).catch(() => null);
        if (!sessionResult) {
          await finalizeSignedOutState();
          return;
        }

        const { data: { session: s }, error } = sessionResult;

        if (error) {
          await finalizeSignedOutState();
          return;
        }

        if (s) {
          const validatedSession = await validateSession(s);
          if (validatedSession) {
            applySession(validatedSession);
            setLoading(false);
            return;
          }

          const refreshResult = await withAuthTimeout(supabase.auth.refreshSession()).catch(() => null);
          const refreshed = refreshResult?.data;
          const refreshedSession = await validateSession(refreshed?.session ?? null);
          if (refreshedSession) {
            applySession(refreshedSession);
            setLoading(false);
            return;
          }
        }

        if (!pendingCallback) break;
        await new Promise((resolve) => window.setTimeout(resolve, AUTH_CALLBACK_RETRY_DELAY_MS));
      }

      await finalizeSignedOutState();
    };

    const handleSessionExpired = () => {
      clearBackendSession();
      applySession(null);
      setLoading(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    }

    void restoreSession();

    return () => {
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string, redirectPath?: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectPath: safeRedirectPath(redirectPath),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return { error: new Error(body?.error || "Sign-in email could not be sent.") };
      }
      const body = await response.json().catch(() => null);
      return { error: null, delayed: Boolean(body?.delayed) };
    } catch {
      return { error: new Error("Sign-in email could not be sent.") };
    }
  };

  const signInWithConsoleToken = async (token: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.session?.access_token) {
        return { error: new Error(body?.error || "Sign-in link is invalid or expired.") };
      }

      const backendSession = {
        access_token: body.session.access_token,
        token_type: body.session.token_type || "bearer",
        expires_at: body.session.expires_at,
        expires_in: body.session.expires_at ? Math.max(0, body.session.expires_at - Math.floor(Date.now() / 1000)) : 0,
        refresh_token: "",
        user: body.session.user,
      } as Session;
      setBackendSession(backendSession);
      setSession(backendSession);
      setUser(backendSession.user);
      return { error: null, next: safeRedirectPath(body.next) };
    } catch {
      return { error: new Error("Sign-in link could not be verified.") };
    }
  };

  const signInWithOAuth = async (provider: "google" | "azure", redirectPath?: string) => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectUrl(redirectPath),
        scopes: provider === "azure" ? "email openid profile" : undefined,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    clearBackendSession();
    if (supabaseConfigured) await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signInWithMagicLink,
        signInWithConsoleToken,
        signInWithOAuth,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
