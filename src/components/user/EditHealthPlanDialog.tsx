import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import type { HealthPlanSectionItem, OperationalHealthPlan } from "@/lib/operationalDemoData";

interface EditHealthPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vyvaUserId: string;
  plan: OperationalHealthPlan | null;
  initialFocusSection?: keyof HealthPlanFormState | null;
  contextHint?: string | null;
}

type HealthPlanFormState = {
  summary_text: string;
  goals_json: string;
  daily_support_json: string;
  monitoring_json: string;
  escalation_json: string;
  caregiver_guidance_json: string;
};

function joinItems(items?: HealthPlanSectionItem[] | null) {
  return Array.isArray(items) ? items.map((item) => item.text).filter(Boolean).join("\n") : "";
}

function parseItems(value: string, existingItems?: HealthPlanSectionItem[] | null) {
  const preservedItems = Array.isArray(existingItems) ? existingItems.filter((item) => item?.text) : [];
  return value
    .split("\n")
    .map((item, index) => {
      if (!item.trim()) return null;
      const preserved = preservedItems[index];
      return {
        id: preserved?.id || `item-${index + 1}`,
        text: item.trim(),
        source_signal_ids: preserved?.source_signal_ids,
        priority: preserved?.priority ?? null,
        due_window: preserved?.due_window ?? null,
        evidence_freshness: preserved?.evidence_freshness ?? null,
        evidence_conflict: preserved?.evidence_conflict ?? null,
        last_verified_at: preserved?.last_verified_at ?? null,
        recheck_after_hours: preserved?.recheck_after_hours ?? null,
        recheck_due_at: preserved?.recheck_due_at ?? null,
        owner_label: preserved?.owner_label ?? null,
        completion_proof: preserved?.completion_proof ?? null,
        escalation_if_not_done: preserved?.escalation_if_not_done ?? null,
        source_task_code: preserved?.source_task_code ?? null,
        staff_disposition: preserved?.staff_disposition ?? null,
        staff_disposition_note: preserved?.staff_disposition_note ?? null,
        staff_disposition_updated_at: preserved?.staff_disposition_updated_at ?? null,
        staff_disposition_updated_by: preserved?.staff_disposition_updated_by ?? null,
        staff_disposition_updated_by_email: preserved?.staff_disposition_updated_by_email ?? null,
      };
    })
    .filter(Boolean) as HealthPlanSectionItem[];
}

export function EditHealthPlanDialog({ open, onOpenChange, vyvaUserId, plan, initialFocusSection = null, contextHint = null }: EditHealthPlanDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const sectionRefs = useRef<Partial<Record<keyof HealthPlanFormState, HTMLTextAreaElement | null>>>({});
  const [form, setForm] = useState<HealthPlanFormState>({
    summary_text: "",
    goals_json: "",
    daily_support_json: "",
    monitoring_json: "",
    escalation_json: "",
    caregiver_guidance_json: "",
  });

  useEffect(() => {
    if (!open || !plan) return;
    setForm({
      summary_text: plan.summary_text || "",
      goals_json: joinItems(plan.goals_json),
      daily_support_json: joinItems(plan.daily_support_json),
      monitoring_json: joinItems(plan.monitoring_json),
      escalation_json: joinItems(plan.escalation_json),
      caregiver_guidance_json: joinItems(plan.caregiver_guidance_json),
    });
  }, [open, plan]);

  useEffect(() => {
    if (!open || !initialFocusSection) return;
    const timer = window.setTimeout(() => {
      const target = sectionRefs.current[initialFocusSection];
      target?.focus();
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [initialFocusSection, open]);

  const update = (key: keyof HealthPlanFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!plan) return;
    if (!form.summary_text.trim()) {
      toast({ title: t("profile.healthPlanSummaryRequired"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/v1/user-dashboard/users/${encodeURIComponent(vyvaUserId)}/health-plan`, {
        method: "PUT",
        body: JSON.stringify({
          language: plan.language,
          review_status: "draft",
          summary_text: form.summary_text.trim(),
          goals_json: parseItems(form.goals_json, plan.goals_json),
          daily_support_json: parseItems(form.daily_support_json, plan.daily_support_json),
          monitoring_json: parseItems(form.monitoring_json, plan.monitoring_json),
          escalation_json: parseItems(form.escalation_json, plan.escalation_json),
          caregiver_guidance_json: parseItems(form.caregiver_guidance_json, plan.caregiver_guidance_json),
        }),
      });
      toast({ title: t("profile.healthPlanSaved") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t("profile.healthPlanSaveFailed"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const sections: Array<{ key: keyof HealthPlanFormState; labelKey: string; rows: number }> = [
    { key: "summary_text", labelKey: "profile.healthPlanSummary", rows: 4 },
    { key: "goals_json", labelKey: "profile.healthPlanGoals", rows: 4 },
    { key: "daily_support_json", labelKey: "profile.healthPlanDailySupport", rows: 4 },
    { key: "monitoring_json", labelKey: "profile.healthPlanMonitoring", rows: 4 },
    { key: "escalation_json", labelKey: "profile.healthPlanEscalation", rows: 4 },
    { key: "caregiver_guidance_json", labelKey: "profile.healthPlanCaregiverGuidance", rows: 4 },
  ];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-3xl rounded-2xl border-border bg-white">
        <DialogHeader>
          <DialogTitle>{t("profile.healthPlanEditTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t("profile.healthPlanEditResetsReview")}
          </div>
          {contextHint ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {contextHint}
            </div>
          ) : null}
          {sections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <Label>{t(section.labelKey)}</Label>
              <Textarea
                ref={(element) => {
                  sectionRefs.current[section.key] = element;
                }}
                value={form[section.key]}
                onChange={(event) => update(section.key, event.target.value)}
                rows={section.rows}
                className="rounded-xl"
                placeholder={section.key === "summary_text" ? t("profile.healthPlanSummaryPlaceholder") : t("profile.healthPlanListPlaceholder")}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-full" disabled={saving} onClick={() => onOpenChange(false)}>
            {t("checkin.cancel")}
          </Button>
          <Button type="button" className="rounded-full" disabled={saving} onClick={handleSave}>
            {saving ? t("checkin.saving") : t("userForm.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
