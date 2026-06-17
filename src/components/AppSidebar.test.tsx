import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "staff-1", email: "karim.assad@mokadigital.net" },
    signOut: vi.fn(),
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => ({
      "settings.role.superAdmin": "Super admin",
      "settings.role.admin": "Admin",
      "sidebar.operator": "Operator",
    }[key] ?? key),
  }),
}));

vi.mock("@/hooks/useCurrentUserContext", () => ({
  useCurrentUserContext: () => ({ data: undefined }),
}));

vi.mock("@/hooks/useGISData", () => ({
  useGISData: () => ({ data: { gisUsers: [] } }),
}));

describe("AppSidebar", () => {
  it("shows the platform admin role for the project admin email before server context loads", () => {
    render(
      <MemoryRouter initialEntries={["/campaigns"]}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("karim.assad@mokadigital.net")).toBeInTheDocument();
    expect(screen.getByText("Super admin")).toBeInTheDocument();
    expect(screen.queryByText("Operator")).not.toBeInTheDocument();
  });
});
