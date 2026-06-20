import type { ReactNode } from "react";
import { Code2, Copy, ShieldCheck, Webhook, type LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";

interface UserApiIntakeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const phoneEndpoint = "/api/v1/onboarding/phone-registration";
const dashboardEndpoint = "/api/v1/user-dashboard/users";

const payloadExample = `{
  "organization_slug": "red-cross-zamora",
  "first_name": "First",
  "last_name": "Last",
  "phone": "+34600123456",
  "language": "es",
  "city": "Zamora",
  "health": {
    "health_conditions": ["diabetes"],
    "mobility_needs": ["walker support"]
  },
  "medications": [{
    "medication_name": "Medication name",
    "dosage": "10mg",
    "purpose": "blood pressure",
    "reminders_enabled": true,
    "schedule_times": ["08:00", "20:00"]
  }],
  "caregivers": [{
    "caretaker_name": "Emergency contact",
    "caretaker_phone": "+34600999000"
  }]
}`;

function copyText(value: string, message: string) {
  if (!navigator.clipboard) return;
  void navigator.clipboard.writeText(value).then(() => {
    toast({ title: message });
  });
}

export function UserApiIntakeDialog({ open, onOpenChange }: UserApiIntakeDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-[1.75rem] border-border bg-[#f7f9ff] p-0 shadow-2xl">
        <DialogHeader className="border-b border-border bg-white px-7 py-6 pr-12 text-left">
          <Badge className="mb-2 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:bg-primary/10">
            {t("userApi.badge")}
          </Badge>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">{t("userApi.title")}</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("userApi.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-12rem)] space-y-4 overflow-y-auto px-7 py-5">
          <Alert className="border-primary/20 bg-primary/5 text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>{t("userApi.securityTitle")}</AlertTitle>
            <AlertDescription>{t("userApi.securityDescription")}</AlertDescription>
          </Alert>

          <EndpointPanel
            copyLabel={t("userApi.copyEndpoint")}
            copyMessage={t("userApi.copied")}
            description={t("userApi.phoneDescription")}
            endpoint={phoneEndpoint}
            icon={Webhook}
            title={t("userApi.phoneTitle")}
          >
            <CodeBlock
              label={t("userApi.headersTitle")}
              value={`Authorization: Bearer <ONBOARDING_API_KEY>\n# or\nx-api-key: <ONBOARDING_API_KEY>\n\n# Optional override when phone country is not enough\nx-organization-slug: red-cross-zamora`}
            />
          </EndpointPanel>

          <EndpointPanel
            copyLabel={t("userApi.copyEndpoint")}
            copyMessage={t("userApi.copied")}
            description={t("userApi.dashboardDescription")}
            endpoint={dashboardEndpoint}
            icon={Code2}
            title={t("userApi.dashboardTitle")}
          >
            <CodeBlock label={t("userApi.payloadTitle")} value={payloadExample} />
          </EndpointPanel>
        </div>

        <DialogFooter className="border-t border-border bg-white px-7 py-4">
          <Button type="button" className="rounded-full" onClick={() => onOpenChange(false)}>
            {t("userApi.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndpointPanel({
  children,
  copyLabel,
  copyMessage,
  description,
  endpoint,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  copyLabel: string;
  copyMessage: string;
  description: string;
  endpoint: string;
  icon: LucideIcon;
  title: string;
}) {
  const fullEndpoint = `${window.location.origin}${endpoint}`;

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button type="button" variant="outline" className="rounded-full bg-white" onClick={() => copyText(fullEndpoint, copyMessage)}>
          <Copy className="mr-2 h-4 w-4" />
          {copyLabel}
        </Button>
      </div>
      <div className="mt-4 overflow-auto rounded-xl border border-border bg-muted/35 px-3 py-2 font-mono text-sm text-foreground">{fullEndpoint}</div>
      {children}
    </section>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}
