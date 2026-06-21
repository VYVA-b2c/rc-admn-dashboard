import { describe, expect, it } from "vitest";

import {
  applyHealthPlanReviewChecklistAudit,
  buildHealthPlanLifeSafetyReviewItems,
  isHealthPlanReviewChecklistComplete,
  missingHealthPlanReviewChecklistItems,
  normalizeHealthPlanReviewChecklist,
} from "./healthPlanReviewChecklist.js";

describe("health plan review checklist", () => {
  it("normalizes missing values to false booleans", () => {
    expect(normalizeHealthPlanReviewChecklist(null)).toEqual({
      reachability_confirmed: false,
      medication_risk_checked: false,
      escalation_path_confirmed: false,
      next_touchpoint_confirmed: false,
      note: null,
      life_safety_confirmations: {},
      confirmation_audit: {},
    });
  });

  it("reports missing urgent confirmations", () => {
    expect(missingHealthPlanReviewChecklistItems({
      reachability_confirmed: true,
      medication_risk_checked: false,
      escalation_path_confirmed: true,
      next_touchpoint_confirmed: false,
    })).toEqual([
      "medication_risk_checked",
      "next_touchpoint_confirmed",
    ]);
  });

  it("detects complete signoff checklists", () => {
    expect(isHealthPlanReviewChecklistComplete({
      reachability_confirmed: true,
      medication_risk_checked: true,
      escalation_path_confirmed: true,
      next_touchpoint_confirmed: true,
    })).toBe(true);
  });

  it("normalizes persisted life-safety confirmations", () => {
    expect(normalizeHealthPlanReviewChecklist({
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
        },
      },
    })).toEqual({
      reachability_confirmed: false,
      medication_risk_checked: false,
      escalation_path_confirmed: false,
      next_touchpoint_confirmed: false,
      note: null,
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
          confirmed_at: null,
          confirmed_by_user_id: null,
          confirmed_by_email: null,
        },
      },
      confirmation_audit: {},
    });
  });

  it("requires explicit confirmation for high-severity clinical cautions", () => {
    const clinicalCautions = [
      {
        id: "reachability-risk",
        label: "Reachability risk needs an explicit response path",
        severity: "high",
      },
      {
        id: "mobility-fall-risk",
        label: "Mobility or fall risk needs practical safety follow-through",
        severity: "medium",
      },
    ];

    expect(buildHealthPlanLifeSafetyReviewItems({ clinicalCautions })).toEqual([
      {
        key: "life_safety:reachability-risk",
        caution_id: "reachability-risk",
        label: "Life-safety check: Reachability risk needs an explicit response path",
        detail: null,
        guidance: null,
      },
    ]);

    expect(missingHealthPlanReviewChecklistItems({
      reachability_confirmed: true,
      medication_risk_checked: true,
      escalation_path_confirmed: true,
      next_touchpoint_confirmed: true,
    }, { clinicalCautions })).toEqual(["life_safety:reachability-risk"]);

    expect(isHealthPlanReviewChecklistComplete({
      reachability_confirmed: true,
      medication_risk_checked: true,
      escalation_path_confirmed: true,
      next_touchpoint_confirmed: true,
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
        },
      },
    }, { clinicalCautions })).toBe(true);
  });

  it("stamps audit metadata when a review is completed", () => {
    expect(applyHealthPlanReviewChecklistAudit({
      reachability_confirmed: true,
      medication_risk_checked: true,
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
        },
      },
    }, {
      reviewedAt: "2026-06-20T09:15:00.000Z",
      actorUserId: "user-123",
      actorEmail: "karim@example.com",
      actionType: "reviewed",
    })).toEqual({
      reachability_confirmed: true,
      medication_risk_checked: true,
      escalation_path_confirmed: false,
      next_touchpoint_confirmed: false,
      note: null,
      confirmation_audit: {
        reachability_confirmed: {
          label: null,
          confirmed_at: "2026-06-20T09:15:00.000Z",
          confirmed_by_user_id: "user-123",
          confirmed_by_email: "karim@example.com",
        },
        medication_risk_checked: {
          label: null,
          confirmed_at: "2026-06-20T09:15:00.000Z",
          confirmed_by_user_id: "user-123",
          confirmed_by_email: "karim@example.com",
        },
      },
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
          confirmed_at: "2026-06-20T09:15:00.000Z",
          confirmed_by_user_id: "user-123",
          confirmed_by_email: "karim@example.com",
        },
      },
    });
  });

  it("preserves prior audit metadata when an already reviewed plan is edited", () => {
    expect(applyHealthPlanReviewChecklistAudit({
      reachability_confirmed: true,
      medication_risk_checked: true,
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
        },
      },
    }, {
      previousChecklist: {
        reachability_confirmed: true,
        medication_risk_checked: true,
        confirmation_audit: {
          reachability_confirmed: {
            confirmed_at: "2026-06-19T08:00:00.000Z",
            confirmed_by_user_id: "reviewer-1",
            confirmed_by_email: "reviewer@example.com",
          },
          medication_risk_checked: {
            confirmed_at: "2026-06-19T08:00:00.000Z",
            confirmed_by_user_id: "reviewer-1",
            confirmed_by_email: "reviewer@example.com",
          },
        },
        life_safety_confirmations: {
          "reachability-risk": {
            confirmed: true,
            label: "Life-safety check: Reachability risk needs an explicit response path",
            confirmed_at: "2026-06-19T08:00:00.000Z",
            confirmed_by_user_id: "reviewer-1",
            confirmed_by_email: "reviewer@example.com",
          },
        },
      },
      reviewedAt: "2026-06-20T09:15:00.000Z",
      actorUserId: "editor-2",
      actorEmail: "editor@example.com",
      actionType: "edited",
    })).toEqual({
      reachability_confirmed: true,
      medication_risk_checked: true,
      escalation_path_confirmed: false,
      next_touchpoint_confirmed: false,
      note: null,
      confirmation_audit: {
        reachability_confirmed: {
          label: null,
          confirmed_at: "2026-06-19T08:00:00.000Z",
          confirmed_by_user_id: "reviewer-1",
          confirmed_by_email: "reviewer@example.com",
        },
        medication_risk_checked: {
          label: null,
          confirmed_at: "2026-06-19T08:00:00.000Z",
          confirmed_by_user_id: "reviewer-1",
          confirmed_by_email: "reviewer@example.com",
        },
      },
      life_safety_confirmations: {
        "reachability-risk": {
          confirmed: true,
          label: "Life-safety check: Reachability risk needs an explicit response path",
          confirmed_at: "2026-06-19T08:00:00.000Z",
          confirmed_by_user_id: "reviewer-1",
          confirmed_by_email: "reviewer@example.com",
        },
      },
    });
  });
});
