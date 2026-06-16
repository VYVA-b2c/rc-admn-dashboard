import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Campaigns from "@/pages/Campaigns";

function renderCampaigns() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/campaigns"]}>
        <AuthProvider>
          <LanguageProvider>
            <Campaigns />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Campaigns", () => {
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

      if (url.includes("/api/v1/campaigns-dashboard/campaigns/1/call-runs")) {
        return new Response(JSON.stringify({ runs: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/campaigns-dashboard/campaigns")) {
        return new Response(JSON.stringify({
          campaigns: [
            {
              id: "1",
              name: "Heatwave alert - Madrid",
              templateKey: "heatwave_alert",
              city: "Madrid",
              status: "draft",
              objective: "Warn clients and confirm cooling support.",
              audience: "Consented clients with a phone number in Madrid.",
              latestRun: null,
            },
          ],
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/campaigns-dashboard/call-runs/")) {
        return new Response(JSON.stringify({ jobs: [] }), {
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

  it("renders the call-first campaign workspace", async () => {
    renderCampaigns();

    expect(screen.getByRole("heading", { name: "VYVA Call Campaigns" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Heatwave alert - Madrid")).toBeInTheDocument();
    });

    expect(screen.getByText("Drafts")).toBeInTheDocument();
    expect(screen.getByText("Queued runs")).toBeInTheDocument();
  });
});
