import { useEffect, useMemo, useState } from "react";
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
}

type HealthPlanFormState = {
  summary_text: string;
  goals_json: string;
  daily_support_json: string;
  monitoring_json: string;
  escalation_json: string;
  caregiver_guidance_json: string;
  manual_override_reason: string;
};

function joinItems(items?: HealthPlanSectionItem[] | null) {
  return Array.isArray(items) ? items.map((item) => item.text).filter(Boolean).join("\n") : "";
}

function parseItems(value: string, existingItems?: HealthPlanSectionItem[] | null) {
  const existing = Array.isArray(existingItems) ? existingItems.filter((item) => item?.text) : [];
  const exactTextBuckets = new Map<string, HealthPlanSectionItem[]>();

  existing.forEach((item) => {
    const key = item.text.trim().toLowerCase();
    if (!key) return;
    exactTextBuckets.set(key, [...(exactTextBuckets.get(key) || []), item]);
  });

  const usedIds = new Set<string>();
  return value
    .split("\n")
    .map((rawItem, index) => {
      const nextText = rawItem.trim();
      if (!nextText) return null;
      const exactKey = nextText.toLowerCase();
      const exactMatch = (exactTextBuckets.get(exactKey) || []).find((item) => item.id && !usedIds.has(item.id));
      const positionalMatch = existing[index] && (!existing[index].id || !usedIds.has(existing[index].id || "")) ? existing[index] : null;
      const matchedItem = exactMatch || positionalMatch || null;
      if (matchedItem?.id) usedIds.add(matchedItem.id);

      return {
        ...(matchedItem || {}),
        id: matchedItem?.id || `item-${index + 1}`,
        text: nextText,
      };
    })
    .filter(Boolean) as HealthPlanSectionItem[];
}

export function EditHealthPlanDialog({ open, onOpenChange, vyvaUserId, plan }: EditHealthPlanDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<HealthPlanFormState>({
    summary_text: "",
    goals_json: "",
    daily_support_json: "",
    monitoring_json: "",
    escalation_json: "",
    caregiver_guidance_json: "",
    manual_override_reason: "",
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
      manual_override_reason: "",
    });
  }, [open, plan]);

  const update = (key: keyof HealthPlanFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const parsedSections = useMemo(() => {
    if (!plan) return null;
    return {
      goals_json: parseItems(form.goals_json, plan.goals_json),
      daily_support_json: parseItems(form.daily_support_json, plan.daily_support_json),
      monitoring_json: parseItems(form.monitoring_json, plan.monitoring_json),
      escalation_json: parseItems(form.escalation_json, plan.escalation_json),
      caregiver_guidance_json: parseItems(form.caregiver_guidance_json, plan.caregiver_guidance_json),
    };
  }, [form.caregiver_guidance_json, form.daily_support_json, form.escalation_json, form.goals_json, form.monitoring_json, plan]);

  const highRiskOverrideCount = useMemo(() => {
    if (!plan || !parsedSections) return 0;
    const sectionKeys: Array<keyof typeof parsedSections> = [
      "goals_json",
      "daily_support_json",
      "monitoring_json",
      "escalation_json",
      "caregiver_guidance_json",
    ];

    return sectionKeys.reduce((count, sectionKey) => {
      const previousItems = Array.isArray(plan[sectionKey]) ? plan[sectionKey] : [];
      const previousById = new Map(previousItems.map((item) => [item.id, item] as const));
      const previousByText = new Map(previousItems.map((item) => [item.text.trim().toLowerCase(), item] as const));

      return count + parsedSections[sectionKey].filter((item) => {
        const previousItem = (item.id ? previousById.get(item.id) : null) || previousByText.get(item.text.trim().toLowerCase()) || null;
        const changed = !previousItem || previousItem.text.trim() !== item.text.trim();
        const priority = previousItem?.priority || item.priority || null;
        const timing = previousItem?.timing || item.timing || null;
        return changed && (priority === "high" || timing === "today");
      }).length;
    }, 0);
  }, [parsedSections, plan]);

  const handleSave = async () => {
    if (!plan) return;
    if (!form.summary_text.trim()) {
      toast({ title: t("profile.healthPlanSummaryRequired"), variant: "destructive" });
      return;
    }
    if (highRiskOverrideCount > 0 && !form.manual_override_reason.trim()) {
      toast({ title: t("profile.healthPlanOverrideReasonRequired"), variant: "destructive" });
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
          manual_override_reason: form.manual_override_reason.trim() || undefined,
          goals_json: parsedSections?.goals_json || [],
          daily_support_json: parsedSections?.daily_support_json || [],
          monitoring_json: parsedSections?.monitoring_json || [],
          escalation_json: parsedSections?.escalation_json || [],
          caregiver_guidance_json: parsedSections?.caregiver_guidance_json || [],
        }),
      });
      toast({ title: t("profile.healthPlanSaved") });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile", vyvaUserId] });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-health-plan-history"] });
      queryClient.invalidateQueries({ queryKey: ["vyva-user-health-plan-history-replay"] });
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
          {sections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <Label>{t(section.labelKey)}</Label>
              <Textarea
                value={form[section.key]}
                onChange={(event) => update(section.key, event.target.value)}
                rows={section.rows}
                className="rounded-xl"
                placeholder={section.key === "summary_text" ? t("profile.healthPlanSummaryPlaceholder") : t("profile.healthPlanListPlaceholder")}
              />
            </div>
          ))}
          {(highRiskOverrideCount > 0 || form.manual_override_reason.trim()) && (
            <div className="space-y-1.5">
              <Label>{t("profile.healthPlanOverrideReasonLabel")}</Label>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("profile.healthPlanOverrideReasonDescription")}
              </p>
              <Textarea
                value={form.manual_override_reason}
                onChange={(event) => update("manual_override_reason", event.target.value)}
                rows={3}
                className="rounded-xl"
                placeholder={t("profile.healthPlanOverrideReasonPlaceholder")}
              />
            </div>
          )}
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
