import { describe, expect, it } from "vitest";

import { buildHealthPlanRefreshStrategy, expandHealthPlanRefreshSections } from "./healthPlanRefreshStrategy.js";

describe("health plan refresh strategy", () => {
  it("prioritizes monitoring and escalation when freshness is critical", () => {
    const strategy = buildHealthPlanRefreshStrategy({
      freshness: {
        status: "critical",
        summary: "Fresh caution signals have overtaken the current plan.",
        recommendation: "Re-review now.",
        should_regenerate: false,
      },
      reviewGovernance: {
        review_required: true,
        review_window: "today",
        review_summary: "Same-day review is still required.",
      },
      sectionDrift: [
        { section_key: "daily_support_json", status: "needs_refresh", reasons: ["Daily support is stale."] },
      ],
    });

    expect(strategy.refresh_now_section_keys).toEqual([
      "daily_support_json",
      "escalation_json",
      "monitoring_json",
    ]);
    expect(strategy.full_regeneration_preferred).toBe(true);
  });

  it("prefers full regeneration when many sections are under pressure", () => {
    const strategy = buildHealthPlanRefreshStrategy({
      freshness: {
        status: "critical",
        should_regenerate: true,
      },
      clinicalCautionIssues: [
        { section_key: "monitoring_json", message: "Monitoring missed a caution." },
        { section_key: "escalation_json", message: "Escalation missed a caution." },
        { section_key: "daily_support_json", message: "Daily support missed a caution." },
      ],
    });

    expect(strategy.full_regeneration_preferred).toBe(true);
  });

  it("expands refresh requests to keep monitoring and escalation aligned", () => {
    const sections = expandHealthPlanRefreshSections(["monitoring_json"], {
      refresh_now_section_keys: ["monitoring_json", "escalation_json"],
    });

    expect(sections).toEqual(["monitoring_json", "escalation_json"]);
  });
});
