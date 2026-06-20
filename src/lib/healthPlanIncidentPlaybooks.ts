import type { OperationalHealthPlan } from "@/lib/operationalDemoData";
import type { HealthPlanHandoffProgress, HealthPlanHandoffSummary } from "@/lib/healthPlanHandoff";
import type { HealthPlanOutreachStatus } from "@/lib/healthPlanOutreach";

export type HealthPlanIncidentPlaybookCode =
  | "urgent_welfare_check"
  | "medication_recovery"
  | "sensor_fallback";

export type HealthPlanIncidentPlaybookPriority = "high" | "medium";
export type HealthPlanIncidentPlaybookActionCode =
  | "assign_owner"
  | "contact_client"
  | "review_medication"
  | "check_sensors"
  | "record_handoff";

export interface HealthPlanIncidentPlaybook {
  code: HealthPlanIncidentPlaybookCode;
  priority: HealthPlanIncidentPlaybookPriority;
  responseWindow: "same_day" | "within_24h";
  triggerReason: string;
  clientSteps: string[];
  careCircleSteps: string[];
  teamSteps: string[];
  closeWhen: string[];
  actionCode: HealthPlanIncidentPlaybookActionCode;
}

type HealthPlanIncidentLanguage = "en" | "de" | "es";

function normalizeText(value?: string | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function firstPlanLine(items?: Array<{ text?: string | null } | null>, matcher?: RegExp) {
  for (const item of safeArray(items)) {
    const text = normalizeText(item?.text);
    if (!text) continue;
    if (!matcher || matcher.test(text)) return text;
  }
  return "";
}

function textMatchesLanguage(text: string, language: HealthPlanIncidentLanguage) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  if (language === "en") return true;
  if (language === "es") {
    return /\b(hoy|persona|medicacion|circulo|cuidado|seguir|avise|hidrat|dosis|seguridad|contacto|apoyo)\b/i.test(normalized);
  }
  return /\b(heute|person|medikation|betreuung|kontakt|unterstuetz|sicher|trink|essen|naechst|pflege)\b/i.test(normalized);
}

function localizedPlanLine(
  items: Array<{ text?: string | null } | null> | null | undefined,
  matcher: RegExp,
  fallback: string,
  language: HealthPlanIncidentLanguage,
) {
  const text = firstPlanLine(items, matcher);
  return text && textMatchesLanguage(text, language) ? text : fallback;
}

function normalizeLanguage(value?: string | null): HealthPlanIncidentLanguage {
  const language = normalizeText(value).toLowerCase().slice(0, 2);
  if (language === "de" || language === "es") return language;
  return "en";
}

function incidentCopy(language: HealthPlanIncidentLanguage) {
  if (language === "de") {
    return {
      urgentTrigger: "Risikosignale fuer heute sind aktiv und ein frischer Kontakt zur Person ist noch nicht dokumentiert.",
      urgentClientFallback: "Die Person direkt erreichen und Sicherheit, Fluessigkeit und die Naehe einer vertrauten Person bestaetigen.",
      urgentClientCalmFallback: "Den naechsten Schritt ruhig, konkret und zeitnah halten, statt Unsicherheit offen zu lassen.",
      urgentOwnerCovered: "Eine klar benannte Person fuer diesen Tagesablauf sichtbar halten.",
      urgentOwnerMissing: "Vor dem naechsten Kontaktversuch eine klar benannte verantwortliche Person festlegen.",
      urgentTouchpoint: "Einen echten Kontaktversuch machen und das Ergebnis sofort dokumentieren.",
      urgentReviewAlerts: "Jeden noch offenen Alarm pruefen und festlegen, wer jeweils handelt.",
      urgentConfirmRisk: "Nach dem Kontakt pruefen, ob das Risiko noch akut wirkt.",
      urgentCareCircleReachable: "Den freigegebenen Betreuungskreis eng erreichbar halten, falls sich Sicherheit oder Erreichbarkeit verschlechtern.",
      urgentCareCircleEscalate: "Wenn die Person nicht erreichbar bleibt, den Betreuungskreis bitten, eine sichere Rueckmeldung oder Vor-Ort-Bestaetigung zu unterstuetzen.",
      urgentCloseTouchpoint: "Ein echter Kontakt mit der Person ist dokumentiert.",
      urgentCloseTiming: "Der naechste Nachverfolgungszeitpunkt ist explizit festgelegt.",
      urgentCloseAlerts: "Offene dringende Alarme haben eine verantwortliche Person oder einen klaren Loesungsweg.",
      medicationTrigger: "Die Medikamenteneinnahme ist unklar oder eine Dosis koennte ausgelassen worden sein.",
      medicationClientFallback: "Bestaetigen, was wirklich eingenommen wurde, was ausfiel und ob die Medikamente griffbereit sind.",
      medicationNoGuess: "Den Medikamentenstatus nicht aus Stille ableiten; in Gespraech oder ueber eine freigegebene Bezugsperson verifizieren.",
      medicationNextDose: "Pruefen, ob die naechste Dosis Unterstuetzung, Beobachtung oder eine Erinnerungs-Uebergabe braucht.",
      medicationEscalate: "Wenn die Person krank, verwirrt oder ungewoehnlich klingt, nach den hinterlegten Warnzeichen eskalieren statt dies als Routine zu behandeln.",
      medicationOwnerCovered: "Die Medikamenten-Nachverfolgung unter einer benannten Person halten, bis sie geklaert ist.",
      medicationOwnerMissing: "Eine benannte Person fuer die Medikamenten-Nachverfolgung zuweisen.",
      medicationCareCircleSupport: "Den Betreuungskreis bitten, Einnahme, Nahrung oder Fluessigkeit zu bestaetigen, wenn dies sicher freigegeben ist.",
      medicationCareCircleChanges: "Den Betreuungskreis bitten, sofort zu melden, wenn Verwirrung, Uebelkeit oder weitere verpasste Dosen auffallen.",
      medicationCloseStatus: "Der Medikamentenstatus fuer den aktuellen Zyklus ist verifiziert.",
      medicationCloseSupport: "Die naechste Erinnerung oder Dosisunterstuetzung ist klar.",
      medicationCloseEscalation: "Jede zugehoerige Eskalation ist dokumentiert oder ausgeschlossen.",
      sensorTrigger: "Sensorstille ist aktiv, daher kann sich das Team nicht nur auf passive Ueberwachung verlassen.",
      sensorClientFallback: "Einen direkten Check-in oder eine Bestaetigung durch den Betreuungskreis nutzen, statt auf die Rueckkehr der Sensordaten zu warten.",
      sensorTeamGap: "Das fehlende Sensorsignal als Informationsluecke behandeln, nicht als Entwarnung.",
      sensorTeamCheck: "Batterie, Verbindung oder Geraeteposition pruefen und den manuellen Fallback dokumentieren.",
      sensorTeamClientReached: "Den Zustand der Person bestaetigen, auch wenn das Geraet spaeter wieder online kommt.",
      sensorTeamClientMissing: "Die Sensorpruefung mit einem echten Wohlfahrtskontakt koppeln.",
      sensorCareCircleFallback: "Den Betreuungskreis bitten, bis zur Rueckkehr des Sensors ein kurzes reales Lagebild zu bestaetigen.",
      sensorCareCirclePlacement: "Wenn moeglich, den Betreuungskreis fragen, ob Akku, Platzierung oder Verbindung des Geraets geprueft werden koennen.",
      sensorCloseFallback: "Ein Fallback-Kontakt hat stattgefunden.",
      sensorCloseReliability: "Die Sensorzuverlaessigkeit wurde geprueft oder ein manueller Backup-Plan ist aktiv.",
      sensorCloseMonitoring: "Die naechste Ueberwachungsmethode ist fuer das Team klar.",
    };
  }

  if (language === "es") {
    return {
      urgentTrigger: "Hay senales de riesgo activas para hoy y todavia no se ha registrado un contacto reciente con la persona.",
      urgentClientFallback: "Contactar directamente con la persona y confirmar seguridad, hidratacion y si hay alguien cerca.",
      urgentClientCalmFallback: "Mantener el siguiente paso tranquilo, concreto y cercano en el tiempo en vez de dejar incertidumbre.",
      urgentOwnerCovered: "Mantener visible una sola persona responsable para este circuito de hoy.",
      urgentOwnerMissing: "Asignar una persona responsable antes del siguiente intento de contacto.",
      urgentTouchpoint: "Hacer un contacto real y registrar el resultado de inmediato.",
      urgentReviewAlerts: "Revisar cada alerta todavia abierta y decidir quien actua sobre cada una.",
      urgentConfirmRisk: "Despues del contacto, confirmar si el riesgo sigue sintiendose actual.",
      urgentCareCircleReachable: "Mantener al circulo de cuidado aprobado facil de localizar si empeoran la seguridad o la capacidad de respuesta.",
      urgentCareCircleEscalate: "Si sigue sin ser posible contactar con la persona, pedir al circulo de cuidado que apoye una confirmacion segura o presencial.",
      urgentCloseTouchpoint: "Se registra un contacto real con la persona.",
      urgentCloseTiming: "El siguiente momento de seguimiento queda explicitado.",
      urgentCloseAlerts: "Las alertas urgentes abiertas tienen una persona responsable o una ruta clara de resolucion.",
      medicationTrigger: "La adherencia de la medicacion es incierta o puede haberse perdido una dosis.",
      medicationClientFallback: "Confirmar que se tomo de verdad, que se perdio y si la medicacion esta al alcance.",
      medicationNoGuess: "No asumir el estado de la medicacion por silencio; verificarlo en conversacion o mediante un cuidador autorizado.",
      medicationNextDose: "Comprobar si la siguiente dosis necesita apoyo, observacion o un relevo de recordatorio.",
      medicationEscalate: "Si la persona suena mal, confundida o fuera de lo habitual, escalar segun las senales guardadas en vez de tratarlo como rutina.",
      medicationOwnerCovered: "Mantener el seguimiento de medicacion bajo una sola persona responsable hasta resolverlo.",
      medicationOwnerMissing: "Asignar una persona responsable para el seguimiento de la medicacion.",
      medicationCareCircleSupport: "Pedir al circulo de cuidado que confirme toma, comida o hidratacion cuando eso este aprobado y sea seguro.",
      medicationCareCircleChanges: "Pedir al circulo de cuidado que avise de inmediato si nota confusion, nauseas o mas dosis perdidas.",
      medicationCloseStatus: "El estado de la medicacion queda verificado para el ciclo actual.",
      medicationCloseSupport: "El siguiente recordatorio o apoyo para la dosis esta claro.",
      medicationCloseEscalation: "Cualquier escalado relacionado esta registrado o descartado.",
      sensorTrigger: "Hay silencio del sensor, asi que el equipo no puede depender solo de la monitorizacion pasiva.",
      sensorClientFallback: "Usar un check-in directo o una confirmacion del circulo de cuidado en vez de esperar a que vuelvan los datos del sensor.",
      sensorTeamGap: "Tratar la falta de senal como una brecha de informacion, no como una senal tranquilizadora.",
      sensorTeamCheck: "Revisar bateria, conectividad o colocacion del dispositivo y registrar el plan manual de respaldo.",
      sensorTeamClientReached: "Confirmar el estado de la persona aunque el dispositivo vuelva a conectarse despues.",
      sensorTeamClientMissing: "Unir la revision del sensor con un contacto real de bienestar.",
      sensorCareCircleFallback: "Pedir al circulo de cuidado una confirmacion breve y real de la situacion hasta que el sensor vuelva.",
      sensorCareCirclePlacement: "Si es posible, pedir al circulo de cuidado que revise bateria, colocacion o conexion del dispositivo.",
      sensorCloseFallback: "Ya ocurrio un contacto de respaldo.",
      sensorCloseReliability: "La fiabilidad del sensor fue revisada o existe un plan manual de respaldo.",
      sensorCloseMonitoring: "El siguiente metodo de monitorizacion esta claro para el equipo.",
    };
  }

  return {
    urgentTrigger: "Same-day risk signals are active and a fresh client touchpoint is not yet recorded.",
    urgentClientFallback: "Reach the elder directly and confirm safety, hydration, and whether someone is nearby.",
    urgentClientCalmFallback: "Keep the next step calm, specific, and close in time rather than leaving the person unsure.",
    urgentOwnerCovered: "Keep one named owner visible for this same-day loop.",
    urgentOwnerMissing: "Assign one named owner before the next outreach attempt.",
    urgentTouchpoint: "Attempt a live touchpoint and log the outcome immediately.",
    urgentReviewAlerts: "Review every still-open alert and decide who is acting on each one.",
    urgentConfirmRisk: "Confirm whether the risk still feels current after contact.",
    urgentCareCircleReachable: "Keep the approved care circle reachable in case safety or responsiveness worsens.",
    urgentCareCircleEscalate: "If the elder still cannot be reached, ask the care circle to help confirm safety or support an in-person check.",
    urgentCloseTouchpoint: "A real client touchpoint is logged.",
    urgentCloseTiming: "The next follow-up timing is explicit.",
    urgentCloseAlerts: "Open urgent alerts have an owner or resolution path.",
    medicationTrigger: "Medication adherence is uncertain or a dose may have been missed.",
    medicationClientFallback: "Confirm what was actually taken, what was missed, and whether medication is within reach.",
    medicationNoGuess: "Do not guess the medication status from silence; verify it in conversation or through an approved caregiver.",
    medicationNextDose: "Check whether the next dose needs support, observation, or a reminder handoff.",
    medicationEscalate: "If the elder sounds unwell or confused, escalate according to the saved warning signs rather than treating this as routine.",
    medicationOwnerCovered: "Keep the medication follow-up under one named owner until it is resolved.",
    medicationOwnerMissing: "Assign a named owner for medication follow-up.",
    medicationCareCircleSupport: "Ask the care circle to help confirm food, hydration, or medication access when that sharing is approved.",
    medicationCareCircleChanges: "Ask the care circle to report confusion, nausea, or more missed doses right away.",
    medicationCloseStatus: "Medication status has been verified for the current cycle.",
    medicationCloseSupport: "The next reminder or dose support is clear.",
    medicationCloseEscalation: "Any related escalation has been logged or ruled out.",
    sensorTrigger: "Sensor silence is active, so the team cannot rely on passive monitoring alone.",
    sensorClientFallback: "Use a direct check-in or caregiver confirmation instead of waiting for sensor data to return.",
    sensorTeamGap: "Treat the missing sensor signal as an information gap, not a reassurance signal.",
    sensorTeamCheck: "Check battery, connectivity, or device placement and record the fallback monitoring plan.",
    sensorTeamClientReached: "Confirm the elder's status even if the device comes back online later.",
    sensorTeamClientMissing: "Pair the sensor check with a live welfare touchpoint.",
    sensorCareCircleFallback: "Ask the care circle to give one real-world status check until the sensor is back.",
    sensorCareCirclePlacement: "If possible, ask the care circle to check battery, placement, or connectivity of the device.",
    sensorCloseFallback: "Fallback contact has happened.",
    sensorCloseReliability: "Sensor reliability has been checked or a manual backup plan is in place.",
    sensorCloseMonitoring: "The next monitoring method is clear to the team.",
  };
}

export function deriveHealthPlanIncidentPlaybooks(input: {
  healthPlan?: OperationalHealthPlan | null;
  handoff?: HealthPlanHandoffSummary | null;
  progress?: HealthPlanHandoffProgress | null;
  outreachStatus?: HealthPlanOutreachStatus | null;
}): HealthPlanIncidentPlaybook[] {
  const plan = input.healthPlan;
  const handoff = input.handoff;
  if (!plan || !handoff) return [];
  const language = normalizeLanguage(plan.language);
  const copy = incidentCopy(language);

  const progress = input.progress;
  const outreachStatus = input.outreachStatus;
  const playbooks: HealthPlanIncidentPlaybook[] = [];
  const clientReached = Boolean(progress?.firstContactMade || outreachStatus?.clientShared);
  const ownerCovered = !handoff.ownerMissing || Boolean(progress?.ownerAssigned);

  if ((handoff.responseWindow === "same_day" || handoff.activeAlertCount > 0 || handoff.highRisk) && !clientReached) {
    playbooks.push({
      code: "urgent_welfare_check",
      priority: "high",
      responseWindow: "same_day",
      triggerReason: copy.urgentTrigger,
      clientSteps: [
        localizedPlanLine(plan.daily_support_json, /\b(today|call|phone|hydr|food|eat|drink|safe|hoy|llam|agua|comida|segur|heute|anruf|trink|essen|sicher)\b/i, copy.urgentClientFallback, language),
        localizedPlanLine(plan.goals_json, /\bcalm|routine|support|touchpoint|tranquil|rutina|apoyo|contact|ruhig|routine|unterstuetz|kontakt\b/i, copy.urgentClientCalmFallback, language),
      ].filter(Boolean),
      careCircleSteps: handoff.sharingBoundary === "approved_circle"
        ? [
            copy.urgentCareCircleReachable,
            copy.urgentCareCircleEscalate,
          ]
        : [],
      teamSteps: [
        ownerCovered ? copy.urgentOwnerCovered : copy.urgentOwnerMissing,
        copy.urgentTouchpoint,
        handoff.activeAlertCount > 0 ? copy.urgentReviewAlerts : copy.urgentConfirmRisk,
      ],
      closeWhen: [
        copy.urgentCloseTouchpoint,
        copy.urgentCloseTiming,
        copy.urgentCloseAlerts,
      ],
      actionCode: "contact_client",
    });
  }

  if (handoff.missedMedication) {
    playbooks.push({
      code: "medication_recovery",
      priority: handoff.responseWindow === "same_day" ? "high" : "medium",
      responseWindow: handoff.responseWindow,
      triggerReason: copy.medicationTrigger,
      clientSteps: [
        localizedPlanLine(plan.daily_support_json, /\bmedic|dose|pill|reminder|adherence|medicac|dosis|pastilla|recordat|medikat|tablett|erinner\b/i, copy.medicationClientFallback, language),
        copy.medicationNoGuess,
      ],
      careCircleSteps: handoff.sharingBoundary === "approved_circle"
        ? [
            copy.medicationCareCircleSupport,
            copy.medicationCareCircleChanges,
          ]
        : [],
      teamSteps: [
        copy.medicationNextDose,
        copy.medicationEscalate,
        ownerCovered ? copy.medicationOwnerCovered : copy.medicationOwnerMissing,
      ],
      closeWhen: [
        copy.medicationCloseStatus,
        copy.medicationCloseSupport,
        copy.medicationCloseEscalation,
      ],
      actionCode: "review_medication",
    });
  }

  if (handoff.offlineSensorCount > 0) {
    playbooks.push({
      code: "sensor_fallback",
      priority: handoff.responseWindow === "same_day" ? "high" : "medium",
      responseWindow: handoff.responseWindow,
      triggerReason: copy.sensorTrigger,
      clientSteps: [
        localizedPlanLine(plan.monitoring_json, /\bsensor|device|report|battery|offline|sensor|dispositivo|bateria|sin conex|sensor|geraet|akku|offline\b/i, copy.sensorClientFallback, language),
      ],
      careCircleSteps: handoff.sharingBoundary === "approved_circle"
        ? [
            copy.sensorCareCircleFallback,
            copy.sensorCareCirclePlacement,
          ]
        : [],
      teamSteps: [
        copy.sensorTeamGap,
        copy.sensorTeamCheck,
        clientReached ? copy.sensorTeamClientReached : copy.sensorTeamClientMissing,
      ],
      closeWhen: [
        copy.sensorCloseFallback,
        copy.sensorCloseReliability,
        copy.sensorCloseMonitoring,
      ],
      actionCode: "check_sensors",
    });
  }

  return playbooks.slice(0, 3);
}
