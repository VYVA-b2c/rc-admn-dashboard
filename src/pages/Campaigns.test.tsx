import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("creates a local campaign draft and filters the campaign queue", async () => {
    renderCampaigns();

    expect(screen.getByRole("heading", { name: "Campaigns" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New campaign" }));
    fireEvent.change(screen.getByLabelText("Campaign name"), {
      target: { value: "Winter welfare check" },
    });
    fireEvent.change(screen.getByLabelText("Audience"), {
      target: { value: "People needing cold weather calls" },
    });
    fireEvent.change(screen.getByLabelText("Objective"), {
      target: { value: "Confirm wellbeing, heating, and service needs." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(screen.getAllByText("Winter welfare check").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByPlaceholderText("Search by campaign, audience, city, owner..."), {
      target: { value: "Heatwave" },
    });

    expect(screen.getByText("Heatwave")).toBeInTheDocument();
    expect(screen.queryByText("Medication confidence")).not.toBeInTheDocument();
  });
});
