import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import RiskQueue from "@/pages/RiskQueue";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/authMode", () => ({
  authBypassEnabled: false,
}));

function renderRiskQueue() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <RiskQueue />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("RiskQueue", () => {
  it("falls back to operational risk data when predictive tables cannot be read", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/insights/")) {
        throw new Error("Database is not configured");
      }

      if (path === "/api/v1/user-dashboard/users") {
        return {
          totalUsers: 1,
          checkinsEnabled: 0,
          activeAlertCount: 1,
          criticalAlertCount: 0,
          totalSensors: 0,
          caregiversLinked: 0,
          cityDistribution: [{ city: "Madrid", count: 1 }],
          activeAlerts: [],
          gisUsers: [
            {
              id: "client-1",
              first_name: "Carmen",
              last_name: "Lopez",
              city: "Madrid",
              country: "Spain",
              phone: "+34 612 345 678",
              date_of_birth: "1942-05-01",
              coords: null,
              activeAlerts: 1,
              criticalAlerts: 0,
              sensorCount: 0,
              offlineSensors: 0,
              checkinEnabled: false,
              healthConditions: 1,
              missedMeds7d: 2,
              riskScore: 72,
              careProviderCount: 0,
              primaryCaregiverName: null,
              primaryProfessionalName: null,
              careProviderNames: [],
              healthPlanAudit: {
                status: "needs_regeneration",
                review_required: true,
                regeneration_recommended: true,
                reasons: [{ code: "new_critical_signals", severity: "high" }],
              },
            },
          ],
        };
      }

      if (path === "/api/v1/operational/offices") return [];
      if (path === "/api/v1/operational/field-staff") {
        return [
          {
            id: "staff-1",
            full_name: "Ana Novak",
            role: "Operator",
            team: "Madrid",
            phone: null,
            status: "active",
            capacity: 32,
            open_cases: 4,
            last_seen_at: null,
            coords: null,
          },
        ];
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    renderRiskQueue();

    await waitFor(() => expect(screen.getByText("Operational data")).toBeInTheDocument());

    expect(screen.queryByText("Predictive insights are unavailable.")).not.toBeInTheDocument();
    expect(screen.getByText("Carmen Lopez")).toBeInTheDocument();
    expect(screen.getByText(/Forecast tables are unavailable/)).toBeInTheDocument();
    expect(screen.getByText("Health plan needs regeneration")).toBeInTheDocument();
  });
});
