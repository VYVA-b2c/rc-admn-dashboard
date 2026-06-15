import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_ORGANIZATION_STORAGE_KEY, apiFetch } from "@/lib/apiClient";

describe("apiFetch organization scoping", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends the active organization id on API requests", async () => {
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
});
