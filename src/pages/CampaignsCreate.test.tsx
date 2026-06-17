import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import Campaigns from "@/pages/Campaigns";

vi.mock("@/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: { id: "staff-1", email: "karim.assad@mokadigital.net" },
    session: { access_token: "demo-token" },
    loading: false,
    signIn: vi.fn(),
    signInWithMagicLink: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({
    isAdmin: true,
    role: "admin",
    roles: ["admin"],
    isPlatformAdmin: false,
    organization: { id: "org-1", name: "Red Cross Leipzig" },
  }),
}));

vi.mock("@/hooks/useGISData", () => ({
  useGISData: () => ({
    data: {
      users: [
        {
          id: "client-1",
          first_name: "Kareem",
          last_name: "Assad",
          city: "Tarifa",
          phone: "+34664338991",
          healthConditions: 1,
          careProviderCount: 0,
          activeAlerts: 1,
          criticalAlerts: 0,
          riskScore: 67,
          missedMeds7d: 1,
        },
      ],
    },
  }),
}));

function renderCampaigns() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/campaigns"]}>
        <LanguageProvider>
          <Campaigns />
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Campaigns create flow", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/v1/campaigns-dashboard/campaigns")) {
        return new Response(JSON.stringify({ campaigns: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the campaign editor from the create button", async () => {
    renderCampaigns();

    const dismissGuide = await screen.findByRole("button", { name: "Got it" });
    fireEvent.click(dismissGuide);

    const createButton = await screen.findByRole("button", { name: "Create call campaign" });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "Create campaign" })).toBeInTheDocument();
  });
});
