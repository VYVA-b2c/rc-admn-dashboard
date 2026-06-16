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

const templateHeaders = [
  "first_name",
  "last_name",
  "phone",
  "date_of_birth",
  "gender",
  "language",
  "street",
  "house_number",
  "post_code",
  "city",
  "care_safety_notes",
  "health_conditions",
  "mobility_needs",
  "medication_name",
  "medication_dosage",
  "medication_purpose",
  "medication_times",
  "caregiver_name",
  "caregiver_phone",
  "consent_given",
  "caretaker_consent",
  "checkin_enabled",
  "checkin_frequency",
  "checkin_preferred_time",
  "brain_coach_enabled",
  "brain_coach_frequency",
  "brain_coach_preferred_time",
];

const headerAliases: Record<string, string> = {
  address: "street",
  birthdate: "date_of_birth",
  caregiver: "caregiver_name",
  caregiver_number: "caregiver_phone",
  caregiver_tel: "caregiver_phone",
  contact_name: "caregiver_name",
  contact_phone: "caregiver_phone",
  conditions: "health_conditions",
  dob: "date_of_birth",
  emergency_notes: "care_safety_notes",
  family_contact: "caregiver_name",
  family_phone: "caregiver_phone",
  first: "first_name",
  firstname: "first_name",
  health: "health_conditions",
  last: "last_name",
  lastname: "last_name",
  medication: "medication_name",
  medication_dose: "medication_dosage",
  medication_schedule: "medication_times",
  medication_time: "medication_times",
  mobile: "phone",
  mobility: "mobility_needs",
  name: "first_name",
  notes: "care_safety_notes",
  phone_number: "phone",
  postcode: "post_code",
  preferred_language: "language",
  schedule_times: "medication_times",
  surname: "last_name",
};

const trueValues = new Set(["1", "active", "enabled", "ja", "si", "true", "y", "yes"]);
const falseValues = new Set(["0", "disabled", "false", "inactive", "n", "nein", "no"]);

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
  return headerAliases[key] ?? key;
}

function isValidPhoneInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  const digits = trimmed.replace(/\D/g, "");
  return /^\+[1-9][0-9\s().-]{6,24}$/.test(trimmed) && digits.length >= 8 && digits.length <= 15;
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function splitList(value: string) {
  return value
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (trueValues.has(normalized)) return true;
  if (falseValues.has(normalized)) return false;
  return null;
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
    const language = (get("language") || "de").trim().toLowerCase().slice(0, 2);
    const dateOfBirth = get("date_of_birth");
    const medicationName = get("medication_name");
    const medicationDosage = get("medication_dosage");
    const medicationPurpose = get("medication_purpose");
    const medicationTimes = splitList(get("medication_times"));
    const checkinTime = get("checkin_preferred_time");
    const brainCoachTime = get("brain_coach_preferred_time");
    const checkinEnabled = parseBooleanValue(get("checkin_enabled"));
    const brainCoachEnabled = parseBooleanValue(get("brain_coach_enabled"));
    const consentGiven = parseBooleanValue(get("consent_given"));
    const caretakerConsent = parseBooleanValue(get("caretaker_consent"));
    const rowErrors: string[] = [];

    if (!firstName || !lastName) rowErrors.push(rowError(t, rowNumber, "userImport.validation.firstLast"));
    if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.date", "date_of_birth"));
    }
    if (!["en", "de", "es"].includes(language)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.language", "language"));
    }
    if (phone && !isValidPhoneInput(phone)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.phone", "phone"));
    }
    if (caregiverPhone && !isValidPhoneInput(caregiverPhone)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.caregiverPhone", "caregiver_phone"));
    }
    if ((medicationDosage || medicationPurpose || medicationTimes.length) && !medicationName) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.medicationName", "medication_name"));
    }
    if (medicationTimes.some((time) => !isValidTime(time))) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.time", "medication_times"));
    }
    if (checkinTime && !isValidTime(checkinTime)) {
      rowErrors.push(rowError(t, rowNumber, "userImport.validation.time", "checkin_preferred_time"));
    }
    if (brainCoachTime && !isValidTime(brainCoachTime)) {
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

    const healthConditions = splitList(get("health_conditions"));
    const mobilityNeeds = splitList(get("mobility_needs"));
    const payload: Record<string, unknown> = {
      city: get("city") || null,
      date_of_birth: dateOfBirth || null,
      emergency_notes: get("care_safety_notes") || null,
      first_name: firstName,
      gender: get("gender") || null,
      house_number: get("house_number") || null,
      language,
      last_name: lastName,
      phone: phone || null,
      post_code: get("post_code") || null,
      street: get("street") || null,
    };

    if (healthConditions.length || mobilityNeeds.length) {
      payload.health = {
        health_conditions: healthConditions,
        mobility_needs: mobilityNeeds,
      };
    }

    if (medicationName) {
      payload.medications = [
        {
          dosage: medicationDosage || null,
          medication_name: medicationName,
          purpose: medicationPurpose || null,
          schedule_times: medicationTimes,
        },
      ];
    }

    if (get("caregiver_name") || caregiverPhone) {
      payload.caregivers = [
        {
          caretaker_name: get("caregiver_name") || null,
          caretaker_phone: caregiverPhone || null,
          source: "csv",
        },
      ];
    }

    if (get("consent_given") || get("caretaker_consent")) {
      payload.consent = {
        caretaker_consent: caretakerConsent ?? false,
        consent_given: consentGiven ?? false,
      };
    }

    if (get("checkin_enabled") || get("checkin_frequency") || checkinTime) {
      payload.checkins = {
        enabled: checkinEnabled ?? false,
        frequency: get("checkin_frequency") || null,
        preferred_time: checkinTime || null,
      };
    }

    if (get("brain_coach_enabled") || get("brain_coach_frequency") || brainCoachTime) {
      payload.brainCoach = {
        enabled: brainCoachEnabled ?? false,
        frequency: get("brain_coach_frequency") || null,
        preferred_time: brainCoachTime || null,
      };
    }

    readyRows.push({ payload, rowNumber });
  });

  return {
    errors,
    readyRows,
    totalRows: dataRows.length,
  };
}

function downloadCsvTemplate() {
  const blob = new Blob([`${templateHeaders.join(",")}\n`], { type: "text/csv;charset=utf-8" });
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
