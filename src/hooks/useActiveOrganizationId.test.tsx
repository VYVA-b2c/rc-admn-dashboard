import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_ORGANIZATION_STORAGE_KEY } from "@/lib/apiClient";
import { useActiveOrganizationId } from "@/hooks/useActiveOrganizationId";

const currentUserContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useCurrentUserContext", () => ({
  useCurrentUserContext: currentUserContextMock,
}));

describe("useActiveOrganizationId", () => {
  afterEach(() => {
    localStorage.clear();
    currentUserContextMock.mockReset();
  });

  it("uses the explicitly selected organization before the context default", () => {
    localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, "org-zamora");
    currentUserContextMock.mockReturnValue({
      data: {
        user: {
          organization: { id: "org-leipzig" },
        },
      },
    });

    const { result } = renderHook(() => useActiveOrganizationId());

    expect(result.current).toBe("org-zamora");
  });

  it("falls back to the context organization when no organization was selected", () => {
    currentUserContextMock.mockReturnValue({
      data: {
        user: {
          organization: { id: "org-leipzig" },
        },
      },
    });

    const { result } = renderHook(() => useActiveOrganizationId());

    expect(result.current).toBe("org-leipzig");
  });
});
