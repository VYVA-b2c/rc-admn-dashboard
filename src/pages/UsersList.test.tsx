import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import UsersList from "@/pages/UsersList";

const navigateMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const gisDataMock = vi.hoisted(() => ({
  data: {
    gisUsers: [] as any[],
  },
  isLoading: false,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({
    isAdmin: true,
    role: "admin",
    roles: ["admin"],
    isPlatformAdmin: false,
    organization: { id: "org-1", name: "Red Cross Leipzig" },
  }),
}));

vi.mock("@/hooks/useCurrentUserContext", () => ({
  useCurrentUserContext: () => ({
    data: {
      user: {
        organization: {
          defaultLanguage: "de",
        },
      },
    },
  }),
}));

vi.mock("@/hooks/useGISData", () => ({
  useGISData: () => gisDataMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: toastMock,
  useToast: () => ({
    dismiss: vi.fn(),
    toast: toastMock,
    toasts: [],
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
  supabaseConfigured: false,
}));

vi.mock("@/lib/authMode", () => ({
  authBypassEnabled: false,
}));

function renderUsersList() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/users"]}>
        <LanguageProvider>
          <UsersList />
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function openAddUserDialog() {
  renderUsersList();
  const createButton = screen.getByRole("button", { name: "Add client" });
  fireEvent.click(createButton);
  return screen.getByRole("dialog");
}

function changeByLabel(container: HTMLElement, label: string, value: string) {
  fireEvent.change(within(container).getByLabelText(label), { target: { value } });
}

function submitDialog(container: HTMLElement) {
  fireEvent.click(within(container).getByRole("button", { name: "Create client" }));
}

describe("UsersList Add User flow", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    toastMock.mockReset();
    gisDataMock.data = { gisUsers: [] };
    gisDataMock.isLoading = false;

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses a scheduled check-in time from upstream snake_case fields for the last contact fallback", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-25T08:00:00+02:00"));
    gisDataMock.data = {
      gisUsers: [
        {
          id: "client-1",
          first_name: "Anna",
          last_name: "Bittner",
          city: "Dresden",
          country: "Germany",
          phone: "+49 151 23456789",
          date_of_birth: null,
          coords: null,
          activeAlerts: 0,
          criticalAlerts: 0,
          sensorCount: 0,
          offlineSensors: 0,
          healthConditions: 0,
          missedMeds7d: 0,
          riskScore: 2,
          checkin_enabled: true,
          checkin_preferred_time: "09:30",
          checkin_last_status: null,
          checkin_last_reported_at: null,
        },
      ],
    };

    renderUsersList();

    expect(screen.getByText("Anna Bittner")).toBeInTheDocument();
    expect(screen.getByText(/09:30/)).toBeInTheDocument();
    expect(screen.queryByText(/No completed contact yet|Noch kein abgeschlossener Kontakt|Sin contacto completado/i)).not.toBeInTheDocument();
  });

  it("lets admins create a client from onboarding-aligned fields", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/v1/user-dashboard/users") && init?.method === "POST") {
        return new Response(JSON.stringify({ user: { id: "new-client-1", first_name: "Ana", last_name: "Lopez" } }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dialog = openAddUserDialog();

    expect(within(dialog).getByText("Mandatory fields")).toBeInTheDocument();
    expect(within(dialog).getByText(/First and last name are required/)).toBeInTheDocument();

    changeByLabel(dialog, "First name", "Ana");
    changeByLabel(dialog, "Last name", "Lopez");
    changeByLabel(dialog, "Phone", "+49 151 23456789");
    changeByLabel(dialog, "Date of birth", "1944-05-12");
    changeByLabel(dialog, "Street", "Care Street");
    changeByLabel(dialog, "House no.", "12A");
    changeByLabel(dialog, "Post code", "04109");
    changeByLabel(dialog, "City", "Leipzig");
    changeByLabel(dialog, "Care safety notes", "Fall risk; call after lunch.");

    const conditionInput = within(dialog).getByPlaceholderText("Add condition, e.g. diabetes");
    fireEvent.change(conditionInput, { target: { value: "diabetes" } });
    fireEvent.keyDown(conditionInput, { key: "Enter" });

    const mobilityInput = within(dialog).getByPlaceholderText("Add need, e.g. walker support");
    fireEvent.change(mobilityInput, { target: { value: "walker support" } });
    fireEvent.keyDown(mobilityInput, { key: "Enter" });

    changeByLabel(dialog, "Medication name", "Metformin");
    changeByLabel(dialog, "Dosage", "500mg");
    changeByLabel(dialog, "Purpose", "blood sugar");
    changeByLabel(dialog, "Schedule times", "08:00, 20:00");

    changeByLabel(dialog, "Contact name", "Maria Lopez");
    changeByLabel(dialog, "Contact phone", "+49 151 99999999");
    fireEvent.click(within(dialog).getByRole("switch", { name: "User consent active" }));
    fireEvent.click(within(dialog).getByRole("switch", { name: "Caregiver contact consent" }));
    fireEvent.click(within(dialog).getByRole("switch", { name: "Scheduled check-in" }));
    fireEvent.click(within(dialog).getByRole("switch", { name: "Brain coach" }));

    const preferredTimes = within(dialog).getAllByLabelText("Preferred time");
    fireEvent.change(preferredTimes[0], { target: { value: "09:30" } });
    fireEvent.change(preferredTimes[1], { target: { value: "15:45" } });

    submitDialog(dialog);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/users/new-client-1"));

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes("/api/v1/user-dashboard/users") && init?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(String(postCall?.[1]?.body));
    expect(body).toMatchObject({
      city: "Leipzig",
      date_of_birth: "1944-05-12",
      emergency_notes: "Fall risk; call after lunch.",
      first_name: "Ana",
      house_number: "12A",
      language: "de",
      last_name: "Lopez",
      phone: "+49 151 23456789",
      post_code: "04109",
      street: "Care Street",
      consent: {
        caretaker_consent: true,
        consent_given: true,
      },
      health: {
        health_conditions: ["diabetes"],
        mobility_needs: ["walker support"],
      },
      medications: [
        {
          dosage: "500mg",
          medication_name: "Metformin",
          purpose: "blood sugar",
          schedule_times: ["08:00", "20:00"],
        },
      ],
      caregivers: [
        {
          caretaker_name: "Maria Lopez",
          caretaker_phone: "+49 151 99999999",
          source: "manual",
        },
      ],
      checkins: {
        enabled: true,
        frequency: "weekly",
        preferred_time: "09:30",
      },
      brainCoach: {
        enabled: true,
        frequency: "weekly",
        preferred_time: "15:45",
      },
    });
  });

  it("requires first and last name before saving", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const dialog = openAddUserDialog();
    submitDialog(dialog);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "First and last name are required" }));
  });

  it("validates phone numbers before saving", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const dialog = openAddUserDialog();
    changeByLabel(dialog, "First name", "Ana");
    changeByLabel(dialog, "Last name", "Lopez");
    changeByLabel(dialog, "Phone", "151234");
    submitDialog(dialog);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("country code") }));
  });

  it("requires a medication name when medication details are entered", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const dialog = openAddUserDialog();
    changeByLabel(dialog, "First name", "Ana");
    changeByLabel(dialog, "Last name", "Lopez");
    changeByLabel(dialog, "Dosage", "500mg");
    submitDialog(dialog);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Medication name is required when medication details are entered" }));
  });

  it("validates medication schedule times before saving", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const dialog = openAddUserDialog();
    changeByLabel(dialog, "First name", "Ana");
    changeByLabel(dialog, "Last name", "Lopez");
    changeByLabel(dialog, "Medication name", "Metformin");
    changeByLabel(dialog, "Schedule times", "8am");
    submitDialog(dialog);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Medication times must use HH:mm format, for example 08:00, 20:00" }));
  });
});
