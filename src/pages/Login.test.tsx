import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "@/pages/Login";
import { toast } from "sonner";

const authMocks = vi.hoisted(() => ({
  signInWithMagicLink: vi.fn(),
}));

vi.mock("@/assets/drk-logo.svg", () => ({
  default: "drk-logo.svg",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: null,
    signInWithMagicLink: authMocks.signInWithMagicLink,
  }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string) =>
      ({
        "common.poweredByVyva": "Powered by VYVA",
        "login.adminAccessHint": "Platform admins and approved console team members only.",
        "login.adminEmail": "Admin email",
        "login.adminSignIn": "Admin sign in",
        "login.enterCredentials": "Enter your credentials to access the dashboard.",
        "login.enterEmailForMagicLink": "Enter your email and we will send you a secure sign-in link.",
        "login.enterYourEmail": "Please enter your email address",
        "login.magicLinkSent": "Magic link sent",
        "login.magicLinkAlreadyRequestedDesc": "A recent link may already be on its way. Check your inbox before requesting another one.",
        "login.magicLinkSentDesc": "Check your inbox and use the secure link to sign in.",
        "login.previewHint": "If login fails in preview, try the published URL.",
        "login.sendMagicLink": "Send magic link",
        "login.sendingMagicLink": "Sending magic link...",
        "login.subtitle": "VYVA x Red Cross operations console",
      })[key] || key,
  }),
}));

vi.mock("@/lib/authMode", () => ({
  authBypassEnabled: false,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login", () => {
  beforeEach(() => {
    authMocks.signInWithMagicLink.mockReset();
    authMocks.signInWithMagicLink.mockResolvedValue({ error: null });
  });

  it("shows email-only magic-link sign-in without OAuth or password controls", () => {
    renderLogin();

    expect(screen.getByLabelText(/admin email/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /send magic link/i })).toBeTruthy();
    expect(screen.queryByText(/continue with google/i)).toBeNull();
    expect(screen.queryByText(/continue with microsoft/i)).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByLabelText(/language selector/i)).toBeNull();
  });

  it("requests a magic link for the entered admin email", async () => {
    renderLogin();

    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: "karim.assad@mokadigital.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(authMocks.signInWithMagicLink).toHaveBeenCalledWith("karim.assad@mokadigital.net", "/");
    });
  });

  it("treats a recently requested link as a successful inbox check", async () => {
    authMocks.signInWithMagicLink.mockResolvedValue({ error: null, delayed: true });
    renderLogin();

    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: "karim.assad@mokadigital.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send magic link/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Magic link sent", {
        description: "A recent link may already be on its way. Check your inbox before requesting another one.",
      });
    });
  });
});
