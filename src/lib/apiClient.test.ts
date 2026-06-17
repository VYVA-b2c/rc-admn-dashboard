import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseAuthMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabaseConfigured: true,
  supabase: {
    auth: supabaseAuthMocks,
  },
}));

vi.mock("@/lib/authMode", () => ({
  authBypassEnabled: false,
}));

import { ACTIVE_ORGANIZATION_STORAGE_KEY, apiFetch } from "@/lib/apiClient";

describe("apiFetch organization scoping", () => {
  afterEach(() => {
    localStorage.clear();
    supabaseAuthMocks.getSession.mockReset();
    supabaseAuthMocks.refreshSession.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends the active organization id on API requests", async () => {
    supabaseAuthMocks.getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, "org-zamora");

    await apiFetch("/api/v1/user-dashboard/users");

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("x-organization-id")).toBe("org-zamora");
  });

  it("refreshes the Supabase session and retries once when the API rejects a stale token", async () => {
    supabaseAuthMocks.getSession.mockResolvedValue({ data: { session: { access_token: "stale-token" } } });
    supabaseAuthMocks.refreshSession.mockResolvedValue({ data: { session: { access_token: "fresh-token" } } });
    const authorizationHeaders: Array<string | null> = [];
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url, init) => {
        authorizationHeaders.push((init?.headers as Headers).get("Authorization"));
        return Promise.resolve(new Response(JSON.stringify({ error: "Invalid session" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }));
      })
      .mockImplementationOnce((_url, init) => {
        authorizationHeaders.push((init?.headers as Headers).get("Authorization"));
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }));
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/v1/campaigns-dashboard/campaigns", {
      method: "POST",
      body: JSON.stringify({ name: "Weather warning" }),
    })).resolves.toEqual({ ok: true });

    expect(supabaseAuthMocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(authorizationHeaders).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
  });
});
