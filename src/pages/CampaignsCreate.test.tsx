import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { Toaster } from "@/components/ui/toaster";
import Campaigns from "@/pages/Campaigns";

const campaignPosts: unknown[] = [];
let mockedCampaigns: unknown[] = [];

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
      gisUsers: [
        {
          id: "client-1",
          first_name: "Kareem",
          last_name: "Assad",
          city: "Tarifa",
          country: "Spain",
          phone: "+34664338991",
          healthConditions: 1,
          careProviderCount: 0,
          careProviderNames: [],
          activeAlerts: 1,
          criticalAlerts: 0,
          riskScore: 67,
          missedMeds7d: 1,
          checkinEnabled: true,
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
          <Toaster />
          <Campaigns />
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openCreateDialog() {
  renderCampaigns();

  const dismissGuide = await screen.findByRole("button", { name: "Got it" });
  fireEvent.click(dismissGuide);

  const createButton = await screen.findByRole("button", { name: "Create campaign" });
  fireEvent.click(createButton);

  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Create campaign" })).toBeInTheDocument();
  return dialog;
}

describe("Campaigns create flow", () => {
  beforeEach(() => {
    campaignPosts.length = 0;
    mockedCampaigns = [];

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || "GET").toUpperCase();

      if (url.includes("/api/v1/campaigns-dashboard/campaigns") && method === "POST") {
        const body = JSON.parse(String(init?.body || "{}"));
        campaignPosts.push(body);
        return new Response(JSON.stringify({
          campaign: {
            id: "campaign-new",
            name: body.name,
            templateKey: body.templateKey,
            targetRules: body.targetRules,
            scheduledAt: body.scheduledAt,
            callScript: body.callScript,
            status: "draft",
          },
        }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes("/api/v1/campaigns-dashboard/campaigns")) {
        return new Response(JSON.stringify({ campaigns: mockedCampaigns }), {
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

  it("shows the corrected wizard step order", async () => {
    const dialog = await openCreateDialog();
    const steps = within(dialog).getByLabelText("Campaign steps");
    const buttons = within(steps).getAllByRole("button");

    expect(buttons[0]).toHaveTextContent(/^1Script/);
    expect(buttons[1]).toHaveTextContent(/^2Audience/);
    expect(buttons[2]).toHaveTextContent(/^3Channel/);
    expect(buttons[3]).toHaveTextContent(/^4Schedule/);
  });

  it("lets admins save template, uploaded audience, channels, and schedule metadata", async () => {
    const dialog = await openCreateDialog();

    fireEvent.change(within(dialog).getByLabelText("Call script"), {
      target: { value: "Please remember the vaccination clinic on Friday." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    fireEvent.click(await within(dialog).findByRole("button", { name: /Upload list/ }));
    fireEvent.change(within(dialog).getByLabelText("Paste list"), {
      target: { value: "+34 664 338 991, kareem@example.com" },
    });
    expect(within(dialog).getByText("Matched phones")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    fireEvent.click(within(dialog).getByRole("button", { name: /WhatsApp/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Email/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    fireEvent.change(within(dialog).getByLabelText("Day"), { target: { value: "2026-07-03" } });
    fireEvent.change(within(dialog).getByLabelText("Time"), { target: { value: "09:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Weekly" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save draft" }));

    await waitFor(() => expect(campaignPosts).toHaveLength(1));
    expect(campaignPosts[0]).toMatchObject({
      callScript: "Please remember the vaccination clinic on Friday.",
      channel: "mixed",
      executionType: "vyva_call",
      targetRules: {
        audienceSource: {
          mode: "upload",
          uploadedList: {
            rawRowCount: 1,
            matchedPhones: ["+34664338991"],
            emails: ["kareem@example.com"],
          },
        },
        channels: ["voice", "whatsapp", "email"],
        schedule: {
          frequency: "weekly",
        },
      },
    });
    expect((campaignPosts[0] as { scheduledAt?: string }).scheduledAt).toContain("2026-07-03");
  });

  it("creates a campaign-only AI script draft", async () => {
    const dialog = await openCreateDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: /Create with AI/ }));
    fireEvent.change(within(dialog).getByLabelText("What should this campaign do?"), {
      target: { value: "Warn seniors about a vaccination appointment window." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Draft with AI" }));

    await waitFor(() => {
      expect((within(dialog).getByLabelText("Call script") as HTMLTextAreaElement).value).toContain("Operational emphasis");
    });
  });

  it("supports all audience modes and validates script/channel progress", async () => {
    const dialog = await openCreateDialog();

    fireEvent.change(within(dialog).getByLabelText("Call script"), { target: { value: "" } });
    expect(within(dialog).getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Call script"), { target: { value: "Short campaign script." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    fireEvent.click(await within(dialog).findByRole("button", { name: /Define criteria/ }));
    expect(within(dialog).getByText("Where?")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Upload list/ }));
    expect(within(dialog).getByText("Upload audience list")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    const voiceChannel = within(dialog)
      .getAllByRole("button", { name: /Voice calls/ })
      .find((button) => button.textContent?.includes("Queue VYVA"));
    expect(voiceChannel).toBeDefined();
    fireEvent.click(voiceChannel as HTMLElement);
    expect(within(dialog).getByText("Select at least one channel.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("requires a date and time before scheduling a voice campaign", async () => {
    mockedCampaigns = [
      {
        id: "campaign-1",
        name: "Vaccination reminder",
        objective: "Remind clients about the vaccination clinic.",
        audience: "Clients with phone consent.",
        templateKey: "medication_reminder",
        targetRules: {
          channels: ["voice"],
          schedule: { frequency: "once", scheduledAt: null },
        },
        dueKey: "campaigns.due.draft",
        city: "Tarifa",
        owner: "Codex",
        status: "draft",
        channel: "phone",
        scheduledAt: null,
        callScript: "Please remember the vaccination clinic on Friday.",
        callWindowStart: "09:00",
        callWindowEnd: "18:00",
        retryLimit: 1,
        executionType: "vyva_call",
        latestRun: null,
        targets: [],
      },
    ];

    renderCampaigns();

    fireEvent.click(await screen.findByRole("button", { name: "Schedule calls" }));

    expect(await screen.findByText("Add a schedule first")).toBeInTheDocument();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Edit campaign");
  });
});
