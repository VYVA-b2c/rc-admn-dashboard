import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { LanguageProvider } from "@/contexts/LanguageContext";
import InviteAdmin from "@/pages/InviteAdmin";

const apiFetchMock = vi.hoisted(() => vi.fn());
const currentUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCurrentUserContext", () => ({
  useCurrentUserContext: () => currentUserMock(),
}));

vi.mock("@/lib/apiClient", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/authMode", () => ({
  authBypassEnabled: false,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

function renderInviteAdmin() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <InviteAdmin />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("InviteAdmin", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    currentUserMock.mockReturnValue({
      data: {
        user: {
          email: "karim.assad@mokadigital.net",
          isAdmin: false,
          isPlatformAdmin: true,
          organization: null,
        },
      },
      isLoading: false,
    });
    apiFetchMock.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === "/api/v1/organizations") {
        return {
          currentOrganization: { id: "org-1", name: "VYVA x Red Cross" },
          organizations: [{ id: "org-1", name: "VYVA x Red Cross" }],
        };
      }
      if (path === "/api/v1/team-members" && options?.method === "POST") {
        return { member: { id: "member-1" }, inviteEmailSent: false };
      }
      if (path === "/api/v1/team-members") return { members: [] };
      return {};
    });
  });

  it("allows platform admins to manage team access using the current organization fallback", async () => {
    renderInviteAdmin();

    const emailInput = await screen.findByLabelText("Email");
    await waitFor(() => expect(emailInput).toBeEnabled());

    fireEvent.change(emailInput, { target: { value: "operator@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add team member" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/v1/team-members", expect.objectContaining({
        method: "POST",
        headers: { "x-organization-id": "org-1" },
      }));
    });
  });

  it("keeps operators blocked from managing team access", async () => {
    currentUserMock.mockReturnValue({
      data: {
        user: {
          email: "operator@example.com",
          isAdmin: false,
          isPlatformAdmin: false,
          organization: { id: "org-1", name: "VYVA x Red Cross" },
        },
      },
      isLoading: false,
    });

    renderInviteAdmin();

    expect(await screen.findByText("Only admins and platform admins can add or manage team access.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });
});
