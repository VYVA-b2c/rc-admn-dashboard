import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string, redirectPath?: string) => Promise<{ error: Error | null }>;
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

    // Listen first, then restore
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log("[Auth] onAuthStateChange:", event);
      applySession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.warn("[Auth] getSession error:", error.message);
        applySession(null);
      } else {
        console.log("[Auth] getSession restored:", s ? "has session" : "no session");
        applySession(s);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signInWithMagicLink = async (email: string, redirectPath?: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authRedirectUrl(redirectPath),
        shouldCreateUser: false,
      },
    });
    return { error: error as Error | null };
  };

  const signInWithOAuth = async (provider: "google" | "azure", redirectPath?: string) => {
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
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
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
