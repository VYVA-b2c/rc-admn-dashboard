import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseMedical, Search, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/apiClient";
import { authBypassEnabled } from "@/lib/authMode";
import type { CareProviderOption } from "@/lib/careProviders";
import { providerCoverageLabel, providerPrimaryMeta, providerTypeShortKey } from "@/lib/careProviders";
import { demoCareProviders } from "@/lib/operationalDemoData";

async function fetchCareProviders() {
  try {
    const data = await apiFetch<{ providers?: CareProviderOption[] }>("/api/v1/care-providers");
    return data.providers ?? [];
  } catch {
    return [];
  }
}

export default function EmergencyContacts() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["emergency-contacts"],
    queryFn: fetchCareProviders,
    retry: false,
  });
  const sourceProviders = authBypassEnabled && providers.length === 0 ? demoCareProviders : providers;

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return sourceProviders;
    return sourceProviders.filter((provider) => (
      (provider.display_name ?? "").toLowerCase().includes(normalized) ||
      provider.phone?.toLowerCase().includes(normalized) ||
      provider.role?.toLowerCase().includes(normalized) ||
      provider.team?.toLowerCase().includes(normalized) ||
      provider.linked_users?.some((user) => user.name?.toLowerCase().includes(normalized) || user.city?.toLowerCase().includes(normalized))
    ));
  }, [sourceProviders, search]);

  const informalCount = sourceProviders.filter((provider) => provider.provider_type === "caregiver").length;
  const professionalCount = sourceProviders.filter((provider) => provider.provider_type === "field_staff").length;
  const assignmentCount = sourceProviders.reduce((total, provider) => total + Number(provider.assignment_count || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">{t("careProviders.directoryTitle")}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("careProviders.directorySubtitle")}</p>
            </div>
          </div>
        </div>
        {authBypassEnabled && (
          <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {t("usersList.previewData")}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label={t("careProviders.informalShort")} value={informalCount} />
        <MetricCard label={t("careProviders.professionalShort")} value={professionalCount} />
        <MetricCard label={t("careProviders.assignments")} value={assignmentCount} />
      </div>

      <Card className="overflow-hidden rounded-2xl border-border bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border p-4">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("careProviders.directorySearch")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-xl bg-muted/35 pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[220px] text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.provider")}</TableHead>
                  <TableHead className="min-w-[110px] text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.type")}</TableHead>
                  <TableHead className="min-w-[180px] text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.phone")}</TableHead>
                  <TableHead className="min-w-[160px] text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.status")}</TableHead>
                  <TableHead className="min-w-[260px] text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.linkedUsers")}</TableHead>
                  <TableHead className="min-w-[120px] text-right text-xs font-bold uppercase tracking-[0.12em]">{t("careProviders.assignments")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex}><Skeleton className="h-4 w-28" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-14 text-center text-muted-foreground">
                      {sourceProviders.length === 0 ? t("careProviders.noProviders") : t("careProviders.noMatches")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((provider) => {
                    const linkedUsers = provider.linked_users ?? [];
                    return (
                      <TableRow key={`${provider.provider_type}-${provider.provider_id ?? provider.id}`} className="bg-white hover:bg-primary/5">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <BriefcaseMedical className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground">{provider.display_name || t("careProviders.unknown")}</p>
                              {providerPrimaryMeta(provider) && (
                                <p className="mt-0.5 max-w-[180px] truncate text-xs font-semibold text-muted-foreground" title={providerCoverageLabel(provider)}>
                                  {providerPrimaryMeta(provider)}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={provider.provider_type === "field_staff" ? "default" : "secondary"} className="whitespace-nowrap rounded-full px-3 py-1">
                            {t(providerTypeShortKey(provider.provider_type))}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{provider.phone || t("profile.noPhone")}</TableCell>
                        <TableCell className="text-sm font-semibold text-muted-foreground">{provider.status || t("profile.active")}</TableCell>
                        <TableCell>
                          {linkedUsers.length === 0 ? (
                            <span className="text-sm text-muted-foreground">{t("careProviders.noLinkedUsers")}</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {linkedUsers.slice(0, 3).map((user) => (
                                <button
                                  key={user.id || user.name}
                                  type="button"
                                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary"
                                  onClick={() => user.id && navigate(`/users/${user.id}`)}
                                >
                                  {[user.name, user.city].filter(Boolean).join(" / ")}
                                </button>
                              ))}
                              {linkedUsers.length > 3 && (
                                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                                  +{linkedUsers.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-foreground">{provider.assignment_count || 0}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-2xl border-border border-t-4 border-t-primary bg-white shadow-sm">
      <CardContent className="flex h-24 items-center justify-between p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <UsersRound className="h-8 w-8 text-primary" />
      </CardContent>
    </Card>
  );
}
