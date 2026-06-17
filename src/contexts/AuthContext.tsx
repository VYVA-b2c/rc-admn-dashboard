import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import { BASE_URL } from "@/lib/apiClient";
import type { Language } from "@/lib/translations";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string, redirectPath?: string, emailLanguage?: Language) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: "google" | "azure", redirectPath?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

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

    if (!supabaseConfigured) {
      applySession(null);
      setLoading(false);
      return;
    }

    // Listen first, then restore
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      applySession(s);
      setLoading(false);
    });

    const restoreSession = async () => {
      const pendingCallback = hasPendingAuthCallback();
      const attempts = pendingCallback ? 8 : 1;

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const { data: { session: s }, error } = await supabase.auth.getSession();

        if (error) {
          applySession(null);
          setLoading(false);
          return;
        }

        if (s) {
          applySession(s);
          setLoading(false);
          return;
        }

        if (!pendingCallback) break;
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }

      applySession(null);
      setLoading(false);
    };

    void restoreSession();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string, redirectPath?: string, emailLanguage: Language = "en") => {
    if (!supabaseConfigured) return { error: new Error("Authentication provider is not configured.") };
    try {
      const response = await fetch(`${BASE_URL}/api/v1/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectPath: safeRedirectPath(redirectPath),
          language: emailLanguage,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        return { error: new Error(body?.error || "Sign-in email could not be sent.") };
      }
      return { error: null };
    } catch {
      return { error: new Error("Sign-in email could not be sent.") };
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
