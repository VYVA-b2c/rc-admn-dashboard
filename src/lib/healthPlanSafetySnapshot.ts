import type { OperationalAlert, OperationalHealthPlan, HealthPlanSectionItem } from "@/lib/operationalDemoData";
import type { HealthPlanHandoffActionCode, HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";
import type { HealthPlanSharePack } from "@/lib/healthPlanSharing";

export type HealthPlanSafetySnapshotState = "urgent" | "watch" | "stable";
export type HealthPlanSafetySystemFlagCode = "active_alerts" | "missed_medication" | "sensor_reliability";

export interface HealthPlanSafetySnapshotFlag {
  kind: "system" | "plan";
  code?: HealthPlanSafetySystemFlagCode;
  text?: string;
}

export interface HealthPlanSafetySnapshot {
  state: HealthPlanSafetySnapshotState;
  responseWindow: "same_day" | "within_24h";
  ownerName: string | null;
  ownerMissing: boolean;
  sharingBoundary: "staff_only" | "approved_circle";
  elderToday: string[];
  careCircleNow: HealthPlanHandoffActionCode[];
  redFlags: HealthPlanSafetySnapshotFlag[];
  elderMessage?: string | null;
  careCircleMessage?: string | null;
}

type HealthPlanSafetyLanguage = "en" | "de" | "es";

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function dedupeStrings(items: Array<string | null | undefined>, limit = 3) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const text = normalizeText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function sortPlanItemsBySignalPriority(items: HealthPlanSectionItem[], plan?: OperationalHealthPlan | null) {
  const signalStrength = new Map(
    safeArray(plan?.source_signals_json)
      .map((signal) => [String(signal?.id || ""), String(signal?.strength || "low")]),
  );

  const score = (item?: HealthPlanSectionItem | null) => {
    const refs = safeArray(item?.source_signal_ids);
    let signalScore = 0;
    for (const ref of refs) {
      const strength = signalStrength.get(String(ref || ""));
      if (strength === "high") signalScore = Math.max(signalScore, 3);
      else if (strength === "medium") signalScore = Math.max(signalScore, 2);
      else if (strength === "low") signalScore = Math.max(signalScore, 1);
    }
    const text = normalizeText(item?.text).toLowerCase();
    const urgencyBoost = /\b(today|same day|urgent|immediately|right away|now)\b/.test(text) ? 1 : 0;
    return signalScore + urgencyBoost;
  };

  return safeArray(items)
    .slice()
    .sort((a, b) => score(b) - score(a));
}

function uniqueActionCodes(actions: Array<HealthPlanHandoffActionCode | null | undefined>, limit = 4) {
  const seen = new Set<HealthPlanHandoffActionCode>();
  const result: HealthPlanHandoffActionCode[] = [];
  for (const action of actions) {
    if (!action || seen.has(action)) continue;
    seen.add(action);
    result.push(action);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeLanguage(value?: string | null): HealthPlanSafetyLanguage {
  const language = normalizeText(value).toLowerCase().slice(0, 2);
  if (language === "de" || language === "es") return language;
  return "en";
}

function safetyCopy(language: HealthPlanSafetyLanguage) {
  if (language === "de") {
    return {
      elderIntroUrgent: "Bitte heute gut erreichbar bleiben. Wir verfolgen die Situation eng, weil es Zeichen gibt, die nicht liegen bleiben sollten.",
      elderIntroWatch: "Bitte heute erreichbar bleiben, waehrend wir die Lage etwas enger beobachten.",
      elderOutro: "Bitte sofort Bescheid geben, wenn es schlechter wird, Unsicherheit entsteht oder Medikamente ausbleiben.",
      careCircleIntro: (ownerName?: string | null) =>
        ownerName
          ? `Dringendes Update fuer den freigegebenen Betreuungskreis: ${ownerName} uebernimmt die heutige Nachverfolgung.`
          : "Dringendes Update fuer den freigegebenen Betreuungskreis: Bitte heute eine klar benannte Person fuer die Nachverfolgung sichtbar halten.",
      careCircleOutro: "Bitte sofort melden, wenn sich Sicherheit, Erreichbarkeit oder Medikamenteneinnahme verschlechtern.",
      careCircleActionTouchpoint: "Heute einen echten Kontakt oder eine sichere Rueckmeldung mit der Person bestaetigen.",
      careCircleActionAlerts: "Auffaellige Veraenderungen oder Warnzeichen heute nicht als Routine behandeln.",
      careCircleActionMedication: "Bitte bestaetigen helfen, ob Medikamente wirklich genommen wurden.",
      careCircleActionSensors: "Nicht davon ausgehen, dass Stille des Sensors Sicherheit bedeutet.",
      careCircleActionOwner: "Eine benannte Person fuer die heutige Rueckmeldung erreichbar halten.",
      careCircleActionRoutine: "Die Routine stabil halten und relevante Veraenderungen schnell weitergeben.",
    };
  }

  if (language === "es") {
    return {
      elderIntroUrgent: "Por favor mantente localizable hoy. Estamos siguiendo la situacion de cerca porque hay senales que no deberian quedarse sin atender.",
      elderIntroWatch: "Por favor mantente localizable hoy mientras observamos la situacion mas de cerca.",
      elderOutro: "Avisanos enseguida si te sientes peor, insegura o si la medicacion no queda confirmada.",
      careCircleIntro: (ownerName?: string | null) =>
        ownerName
          ? `Actualizacion urgente para el circulo de cuidado autorizado: ${ownerName} lleva el seguimiento de hoy.`
          : "Actualizacion urgente para el circulo de cuidado autorizado: por favor mantened visible una persona responsable para el seguimiento de hoy.",
      careCircleOutro: "Por favor avisad de inmediato si empeoran la seguridad, la capacidad de respuesta o la adherencia de la medicacion.",
      careCircleActionTouchpoint: "Confirmad hoy un contacto real o una respuesta segura de la persona.",
      careCircleActionAlerts: "No trateis cambios preocupantes o alertas como si fueran rutina.",
      careCircleActionMedication: "Ayudad a confirmar si la medicacion se tomo de verdad.",
      careCircleActionSensors: "No deis por hecho que el silencio del sensor significa seguridad.",
      careCircleActionOwner: "Mantened localizable a una persona responsable de la devolucion de hoy.",
      careCircleActionRoutine: "Ayudad a mantener la rutina estable y avisad pronto de cambios importantes.",
    };
  }

  return {
    elderIntroUrgent: "Please stay reachable today. We are following this closely because there are signs that should not sit idle.",
    elderIntroWatch: "Please stay reachable today while we keep a closer watch on things.",
    elderOutro: "Tell us right away if you feel worse, feel unsafe, or medication is not confirmed.",
    careCircleIntro: (ownerName?: string | null) =>
      ownerName
        ? `Urgent update for the approved care circle: ${ownerName} owns today's follow-up.`
        : "Urgent update for the approved care circle: please keep one clearly named person visible for today's follow-up.",
    careCircleOutro: "Please tell us immediately if safety, responsiveness, or medication follow-through gets worse.",
    careCircleActionTouchpoint: "Confirm one real touchpoint or safe reply from the elder today.",
    careCircleActionAlerts: "Do not treat worrying changes or open alerts as routine today.",
    careCircleActionMedication: "Help confirm whether medication was actually taken.",
    careCircleActionSensors: "Do not assume sensor silence means safety.",
    careCircleActionOwner: "Keep one named person reachable for today's feedback loop.",
    careCircleActionRoutine: "Help keep the routine steady and report meaningful changes quickly.",
  };
}

function careCircleActionText(action: HealthPlanHandoffActionCode, language: HealthPlanSafetyLanguage) {
  const copy = safetyCopy(language);
  if (action === "confirm_today_touchpoint") return copy.careCircleActionTouchpoint;
  if (action === "review_alerts") return copy.careCircleActionAlerts;
  if (action === "verify_medication") return copy.careCircleActionMedication;
  if (action === "check_sensors") return copy.careCircleActionSensors;
  if (action === "assign_owner") return copy.careCircleActionOwner;
  return copy.careCircleActionRoutine;
}

function joinBullets(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
}

function textMatchesLanguage(text: string, language: HealthPlanSafetyLanguage) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  if (language === "en") return true;
  if (language === "es") {
    return /\b(hoy|persona|medicacion|circulo|cuidado|seguimiento|hidrat|dosis|seguridad|contacto|apoyo|respuesta|rutina)\b/i.test(normalized);
  }
  return /\b(heute|person|medikation|betreuung|nachverfolg|fluessig|sicher|kontakt|unterstuetz|antwort|routine)\b/i.test(normalized);
}

function elderFallbackSteps(handoff: HealthPlanHandoffSummary, language: HealthPlanSafetyLanguage) {
  if (language === "de") {
    return [
      "Heute bestaetigen, dass Sicherheit, Fluessigkeit und Erreichbarkeit stabil sind.",
      handoff.missedMedication
        ? "Heute bestaetigen, ob Medikamente verstanden und wirklich genommen wurden."
        : handoff.offlineSensorCount > 0
          ? "Heute lieber direkt rueckmelden als sich auf stille Sensoren zu verlassen."
          : "Heute einen klaren Kontaktpunkt halten und Veraenderungen sofort melden.",
    ];
  }
  if (language === "es") {
    return [
      "Confirmar hoy que la seguridad, la hidratacion y la capacidad de respuesta siguen estables.",
      handoff.missedMedication
        ? "Confirmar hoy si la medicacion se entendio y realmente se tomo."
        : handoff.offlineSensorCount > 0
          ? "Hoy es mejor dar una respuesta directa que confiar en sensores silenciosos."
          : "Mantener hoy un punto de contacto claro y avisar de inmediato si algo cambia.",
    ];
  }
  return [
    "Confirm today that safety, hydration, and responsiveness still feel steady.",
    handoff.missedMedication
      ? "Confirm today whether medication was understood and actually taken."
      : handoff.offlineSensorCount > 0
        ? "Use a direct reply today instead of relying on quiet sensors."
        : "Keep one clear touchpoint today and report changes right away.",
  ];
}

export function deriveHealthPlanSafetySnapshot(input: {
  healthPlan?: OperationalHealthPlan | null;
  handoff?: HealthPlanHandoffSummary | null;
  sharePack?: HealthPlanSharePack | null;
  alerts?: OperationalAlert[] | null;
}): HealthPlanSafetySnapshot | null {
  const plan = input.healthPlan;
  const handoff = input.handoff;
  if (!plan || !handoff) return null;
  const language = normalizeLanguage(plan.language);
  const copy = safetyCopy(language);

  const activeAlertCount = safeArray(input.alerts).filter((alert) => !alert?.resolved_at).length || handoff.activeAlertCount || 0;
  const elderToday = dedupeStrings(
    safeArray(input.sharePack?.todayFocus).length > 0
      ? input.sharePack?.todayFocus
      : [
          ...sortPlanItemsBySignalPriority(safeArray(plan.daily_support_json), plan).map((item) => item?.text),
          ...sortPlanItemsBySignalPriority(safeArray(plan.goals_json), plan).map((item) => item?.text),
        ],
    3,
  );

  const careCircleNow = uniqueActionCodes(
    safeArray(handoff.actions).map((action) => action.code),
    4,
  );

  const redFlags: HealthPlanSafetySnapshotFlag[] = [];
  if (activeAlertCount > 0) redFlags.push({ kind: "system", code: "active_alerts" });
  if (handoff.missedMedication) redFlags.push({ kind: "system", code: "missed_medication" });
  if (handoff.offlineSensorCount > 0) redFlags.push({ kind: "system", code: "sensor_reliability" });

  for (const item of sortPlanItemsBySignalPriority(safeArray(plan.escalation_json), plan)) {
    const text = normalizeText(item?.text);
    if (!text) continue;
    redFlags.push({ kind: "plan", text });
    if (redFlags.length >= 3) break;
  }

  const uniqueFlags: HealthPlanSafetySnapshotFlag[] = [];
  const seenFlagKeys = new Set<string>();
  for (const flag of redFlags) {
    const key = flag.kind === "system" ? `system:${flag.code}` : `plan:${flag.text}`;
    if (seenFlagKeys.has(key)) continue;
    seenFlagKeys.add(key);
    uniqueFlags.push(flag);
    if (uniqueFlags.length >= 3) break;
  }

  const state: HealthPlanSafetySnapshotState =
    handoff.responseWindow === "same_day" || activeAlertCount > 0 || handoff.missedMedication || handoff.ownerMissing
      ? "urgent"
      : handoff.offlineSensorCount > 0 || plan.review_status !== "reviewed" || plan.quality?.recommended_action === "review"
        ? "watch"
        : "stable";

  const safeElderMessagePoints = elderToday
    .slice(0, 2)
    .map((item, index) => (textMatchesLanguage(item, language) ? item : elderFallbackSteps(handoff, language)[index]))
    .filter(Boolean);

  const elderMessage = [
    state === "urgent" ? copy.elderIntroUrgent : copy.elderIntroWatch,
    joinBullets(safeElderMessagePoints.length > 0 ? safeElderMessagePoints : elderFallbackSteps(handoff, language)),
    copy.elderOutro,
  ].filter(Boolean).join("\n\n");

  const careCircleMessage =
    handoff.sharingBoundary === "approved_circle"
      ? [
          copy.careCircleIntro(handoff.ownerName),
          joinBullets(careCircleNow.slice(0, 2).map((action) => careCircleActionText(action, language))),
          copy.careCircleOutro,
        ].filter(Boolean).join("\n\n")
      : null;

  return {
    state,
    responseWindow: handoff.responseWindow,
    ownerName: handoff.ownerName,
    ownerMissing: handoff.ownerMissing,
    sharingBoundary: handoff.sharingBoundary,
    elderToday,
    careCircleNow: careCircleNow.length > 0 ? careCircleNow : ["maintain_routine"],
    redFlags: uniqueFlags,
    elderMessage,
    careCircleMessage,
  };
}
