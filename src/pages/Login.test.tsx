import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Login from "@/pages/Login";

const authMocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithMagicLink: vi.fn(),
}));

vi.mock("@/assets/drk-logo.svg", () => ({
  default: "drk-logo.svg",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: null,
    signIn: authMocks.signIn,
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
        "login.magicLinkSentDesc": "Check your inbox and use the secure link to sign in.",
        "login.password": "Password",
        "login.previewHint": "If login fails in preview, try the published URL.",
        "login.sendMagicLink": "Send magic link",
        "login.sendingMagicLink": "Sending magic link...",
        "login.signIn": "Sign In",
        "login.signingIn": "Signing in...",
        "login.subtitle": "VYVA x Red Cross operations console",
        "login.useMagicLinkInstead": "Use magic link instead",
        "login.usePasswordInstead": "Use password instead",
      })[key] || key,
  }),
}));

vi.mock("@/components/LanguageSelector", () => ({
  LanguageSelector: () => <div aria-label="language selector" />,
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
    authMocks.signIn.mockReset();
    authMocks.signInWithMagicLink.mockReset();
    authMocks.signIn.mockResolvedValue({ error: null });
    authMocks.signInWithMagicLink.mockResolvedValue({ error: null });
  });

  it("shows magic-link sign-in without OAuth buttons", () => {
    renderLogin();

    expect(screen.getByRole("button", { name: /send magic link/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /use password instead/i })).toBeTruthy();
    expect(screen.queryByText(/continue with google/i)).toBeNull();
    expect(screen.queryByText(/continue with microsoft/i)).toBeNull();
  });

  it("uses password sign-in when the fallback is selected", async () => {
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: /use password instead/i }));
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: "karim.assad@mokadigital.net" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "temporary-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(authMocks.signIn).toHaveBeenCalledWith("karim.assad@mokadigital.net", "temporary-pass");
    });
    expect(authMocks.signInWithMagicLink).not.toHaveBeenCalled();
  });
});
