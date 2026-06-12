import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import Campaigns from "@/pages/Campaigns";

function renderCampaigns() {
  return render(
    <MemoryRouter initialEntries={["/campaigns"]}>
      <LanguageProvider>
        <Campaigns />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("Campaigns", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

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
