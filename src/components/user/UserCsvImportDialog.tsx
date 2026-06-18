import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import {
  buildUserIntakePayload,
  isValidIntakePhone,
  isValidIntakeTime,
  normalizeIntakeLanguage,
  parseIntakeBoolean,
  splitIntakeList,
  userIntakeHeaderAliases,
  userIntakeTemplateHeaders,
  type CaregiverIntake,
  type MedicationIntake,
} from "@/lib/userIntake";

type Translate = (key: string) => string;

type PreparedCsvRow = {
  payload: Record<string, unknown>;
  rowNumber: number;
};

type CsvReview = {
  errors: string[];
  readyRows: PreparedCsvRow[];
  totalRows: number;
};

interface UserCsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CSV_ROW_LIMIT = 250;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === "\"") {
      if (inQuotes && nextCharacter === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += character;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((csvRow) => csvRow.some((value) => value.trim()));
}

function normalizeHeader(value: string) {
  const key = value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return userIntakeHeaderAliases[key] ?? key;
}

function rowError(t: Translate, rowNumber: number, messageKey: string, field?: string) {
  const suffix = field ? ` (${field})` : "";
  return `${t("userImport.row")} ${rowNumber}: ${t(messageKey)}${suffix}`;
}

function prepareCsvImport(text: string, t: Translate): CsvReview {
  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      errors: [t("userImport.validation.noRows")],
      readyRows: [],
      totalRows: 0,
    };
  }

  const headers = table[0].map(normalizeHeader);
  const dataRows = table.slice(1);
  const limitedRows = dataRows.slice(0, CSV_ROW_LIMIT);
  const errors: string[] = [];
  const readyRows: PreparedCsvRow[] = [];

  if (dataRows.length > CSV_ROW_LIMIT) {
    errors.push(t("userImport.validation.rowLimit"));
  }

  limitedRows.forEach((csvRow, index) => {
    const rowNumber = index + 2;
    const row = headers.reduce<Record<string, string>>((current, header, cellIndex) => {
      if (header) current[header] = (csvRow[cellIndex] ?? "").trim();
      return current;
    }, {});

    const get = (key: string) => row[key] ?? "";
    const firstName = get("first_name");
    const lastName = get("last_name");
    const phone = get("phone");
    const caregiverPhone = get("caregiver_phone");
    const language = normalizeIntakeLanguage(get("language") || "de");
    const dateOfBirth = get("date_of_birth");
    const medicationName = get("medication_name");
    const medicationDosage = get("medication_dosage");
    const medicationFrequency = get("medication_frequency");
    const medicationPurpose = get("medication_purpose");
    const medicationTimes = splitIntakeList(get("medication_times"));
    const checkinTime = get("checkin_preferred_time");
    const brainCoachTime = get("brain_coach_preferred_time");
    const checkinEnabled = parseIntakeBoolean(get("checkin_enabled"));
    const brainCoachEnabled = parseIntakeBoolean(get("brain_coach_enabled"));
    const consentGiven = parseIntakeBoolean(get("consent_given"));
    const caretakerConsent = parseIntakeBoolean(get("caretaker_consent"));
    const rowErrors: string[] = [];

    if (!firstName || !lastName) rowErrors.push(rowError(t, rowNumber, "userImport.validation.firstLast"));
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.date", "date_of_birth"));
    }
    if (get("language") && !["en", "de", "es"].includes(get("language").trim().toLowerCase().slice(0, 2))) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.language", "language"));
    }
    if (phone && !isValidIntakePhone(phone)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.phone", "phone"));
    }
    if (caregiverPhone && !isValidIntakePhone(caregiverPhone)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.caregiverPhone", "caregiver_phone"));
    }
    if ((medicationDosage || medicationFrequency || medicationPurpose || medicationTimes.length) && !medicationName) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.medicationName", "medication_name"));
    }
    if (medicationTimes.some((time) => !isValidIntakeTime(time))) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.time", "medication_times"));
    }
    if (checkinTime && !isValidIntakeTime(checkinTime)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.time", "checkin_preferred_time"));
    }
    if (brainCoachTime && !isValidIntakeTime(brainCoachTime)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.time", "brain_coach_preferred_time"));
    }

    [
      ["checkin_enabled", checkinEnabled],
      ["brain_coach_enabled", brainCoachEnabled],
      ["consent_given", consentGiven],
      ["caretaker_consent", caretakerConsent],
    ].forEach(([field, value]) => {
      if (value === null) rowErrors.push(rowError(t, rowNumber, "userImport.validation.boolean", String(field)));
    });

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    const medications: MedicationIntake[] = medicationName
      ? [{
          dosage: medicationDosage,
          frequency: medicationFrequency,
          medication_name: medicationName,
          purpose: medicationPurpose,
          reminders_enabled: true,
          schedule_times: medicationTimes.join(", "),
        }]
      : [];
    const caregivers: CaregiverIntake[] = get("caregiver_name") || caregiverPhone
      ? [{ caretaker_name: get("caregiver_name"), caretaker_phone: caregiverPhone }]
      : [];
    const payload = buildUserIntakePayload({
      identity: {
        city: get("city"),
        date_of_birth: dateOfBirth,
        emergency_notes: get("care_safety_notes"),
        first_name: firstName,
        gender: get("gender"),
        house_number: get("house_number"),
        language,
        last_name: lastName,
        phone,
        post_code: get("post_code"),
        street: get("street"),
      },
      brainCoach: get("brain_coach_enabled") || get("brain_coach_frequency") || brainCoachTime
        ? { enabled: brainCoachEnabled ?? false, frequency: get("brain_coach_frequency"), preferred_time: brainCoachTime }
        : null,
      brainCoachPresent: Boolean(get("brain_coach_enabled") || get("brain_coach_frequency") || brainCoachTime),
      caregiverConsent: caretakerConsent ?? false,
      caregiverSource: "csv",
      caregivers,
      checkins: get("checkin_enabled") || get("checkin_frequency") || checkinTime
        ? { enabled: checkinEnabled ?? false, frequency: get("checkin_frequency"), preferred_time: checkinTime }
        : null,
      checkinsPresent: Boolean(get("checkin_enabled") || get("checkin_frequency") || checkinTime),
      consentPresent: Boolean(get("consent_given") || get("caretaker_consent")),
      healthConditions: splitIntakeList(get("health_conditions")),
      medications,
      mobilityNeeds: splitIntakeList(get("mobility_needs")),
      userConsent: consentGiven ?? false,
    });

    readyRows.push({ payload, rowNumber });
  });

  return {
    errors,
    readyRows,
    totalRows: dataRows.length,
  };
}

function downloadCsvTemplate() {
  const blob = new Blob([`${userIntakeTemplateHeaders.join(",")}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vyva-care-profile-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function UserCsvImportDialog({ open, onOpenChange }: UserCsvImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [fileName, setFileName] = useState("");
  const [review, setReview] = useState<CsvReview | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = async (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setProgress(0);

    try {
      const text = await file.text();
      setReview(prepareCsvImport(text, t));
    } catch {
      setReview({
        errors: [t("userImport.parseFailed")],
        readyRows: [],
        totalRows: 0,
      });
    }
  };

  const handleImport = async () => {
    if (!review?.readyRows.length) {
      toast({ title: t("userImport.noReadyRows"), variant: "destructive" });
      return;
    }

    setImporting(true);
    setProgress(0);
    let imported = 0;
    let failed = 0;

    for (let index = 0; index < review.readyRows.length; index += 1) {
      try {
        await apiFetch("/api/v1/user-dashboard/users", {
          body: JSON.stringify(review.readyRows[index].payload),
          method: "POST",
          timeoutMs: 10000,
        });
        imported += 1;
      } catch {
        failed += 1;
      }
      setProgress(Math.round(((index + 1) / review.readyRows.length) * 100));
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gis-data"] }),
      queryClient.invalidateQueries({ queryKey: ["vyva-user-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["checkin-monitoring"] }),
    ]);

    if (imported && !failed) {
      toast({ title: `${imported} ${t("userImport.importSuccess")}` });
      onOpenChange(false);
    } else if (imported && failed) {
      toast({
        title: t("userImport.importPartial"),
        description: `${imported} ${t("userImport.imported")}, ${failed} ${t("userImport.failed")}`,
        variant: "destructive",
      });
    } else {
      toast({ title: t("userImport.importFailed"), variant: "destructive" });
    }

    setImporting(false);
  };

  const previewErrors = review?.errors.slice(0, 8) ?? [];

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !importing && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-[1.75rem] border-border bg-[#f7f9ff] p-0 shadow-2xl">
        <DialogHeader className="border-b border-border bg-white px-7 py-6 pr-12 text-left">
          <Badge className="mb-2 w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-primary hover:bg-primary/10">
            {t("userImport.csvBadge")}
          </Badge>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">{t("userImport.csvTitle")}</DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("userImport.csvDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-12rem)] space-y-4 overflow-y-auto px-7 py-5">
          <Alert className="border-primary/20 bg-primary/5 text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <AlertTitle>{t("userImport.minimumTitle")}</AlertTitle>
            <AlertDescription>{t("userImport.minimumNotice")}</AlertDescription>
          </Alert>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <Label className="text-base font-bold text-foreground">{t("userImport.chooseFile")}</Label>
                <p className="mt-1 text-sm text-muted-foreground">{t("userImport.templateHelp")}</p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => void handleFileChange(event.target.files?.[0])}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                {fileName ? t("userImport.replaceFile") : t("userImport.chooseCsv")}
              </Button>
              <Button type="button" variant="outline" className="rounded-full bg-white" onClick={downloadCsvTemplate}>
                <Download className="mr-2 h-4 w-4" />
                {t("userImport.downloadTemplate")}
              </Button>
            </div>

            <p className="mt-3 text-sm font-medium text-muted-foreground">{fileName || t("userImport.noFile")}</p>
          </div>

          {review && (
            <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <h3 className="text-base font-bold text-foreground">{t("userImport.reviewTitle")}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <ReviewStat label={t("userImport.totalRows")} value={review.totalRows} />
                <ReviewStat label={t("userImport.readyRows")} value={review.readyRows.length} tone="success" />
                <ReviewStat label={t("userImport.issueRows")} value={review.errors.length} tone={review.errors.length ? "warning" : "success"} />
              </div>

              {previewErrors.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    {t("userImport.errorsTitle")}
                  </div>
                  <ul className="max-h-36 space-y-1 overflow-y-auto text-sm text-amber-900">
                    {previewErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                  {review.errors.length > previewErrors.length && (
                    <p className="mt-2 text-xs font-semibold text-amber-900">{t("userImport.moreErrors")}</p>
                  )}
                </div>
              )}

              {importing && (
                <div className="mt-4 space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs font-semibold text-muted-foreground">{progress}%</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border bg-white px-7 py-4">
          <Button type="button" variant="outline" className="rounded-full bg-white" disabled={importing} onClick={() => onOpenChange(false)}>
            {t("userForm.cancel")}
          </Button>
          <Button type="button" className="rounded-full" disabled={importing || !review?.readyRows.length} onClick={() => void handleImport()}>
            {importing ? t("userImport.importing") : t("userImport.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewStat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" }) {
  const toneClass =
    tone === "success" ? "text-emerald-700 bg-emerald-50" : tone === "warning" ? "text-amber-700 bg-amber-50" : "text-foreground bg-muted/45";

  return (
    <div className={`rounded-xl px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-75">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {tone === "success" && value > 0 ? <CheckCircle2 className="h-4 w-4" /> : null}
      </div>
    </div>
  );
}
