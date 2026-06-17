import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const supabaseAuthMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabaseConfigured: true,
  supabase: {
    auth: supabaseAuthMocks,
  },
}));

vi.mock("@/lib/apiClient", () => ({
  BASE_URL: "",
  AUTH_SESSION_EXPIRED_EVENT: "vyva:session-expired",
}));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function AuthProbe() {
  const { loading, session } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{session ? "signed-in" : "signed-out"}</div>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    supabaseAuthMocks.getSession.mockReset();
    supabaseAuthMocks.getUser.mockReset();
    supabaseAuthMocks.refreshSession.mockReset();
    supabaseAuthMocks.signOut.mockReset();
    supabaseAuthMocks.onAuthStateChange.mockReset();

    supabaseAuthMocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });

    supabaseAuthMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
          user: { id: "user-1", email: "admin@example.com" },
        },
      },
    });
    supabaseAuthMocks.getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "admin@example.com" },
      },
      error: null,
    });
    supabaseAuthMocks.refreshSession.mockResolvedValue({ data: { session: null } });
    supabaseAuthMocks.signOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("drops back to signed-out state when the session-expired event is dispatched", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("signed-in")).toBeInTheDocument();
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent("vyva:session-expired"));
    });

    await waitFor(() => {
      expect(screen.getByText("signed-out")).toBeInTheDocument();
    });
  });
});
