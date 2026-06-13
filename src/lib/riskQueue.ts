import type {
  OperationalChannel,
  OperationalQueueUser,
  OperationalStatus,
} from "@/lib/operationalDemoData";
import { computeRiskScore } from "@/lib/riskScore";

export type FilterKey = "all" | "urgent" | "review" | "no-response" | "medication" | "checkins" | "unassigned";
export type QueueAction = "call" | "review" | "assign" | "monitor";

export type RiskQueueRow = {
  id: string;
  name: string;
  initials: string;
  city: string;
  age?: number;
  score: number;
  status: OperationalStatus;
  reasonKey: string;
  channel: OperationalChannel;
  lastContactKey: string;
  assignedTo?: string | null;
  action: QueueAction;
  hasMedicationIssue: boolean;
  hasCheckinIssue: boolean;
  hasNoResponse: boolean;
  isUnassigned: boolean;
  livingContextKey?: string;
};

export const riskQueueFilterKeys: FilterKey[] = [
  "all",
  "urgent",
  "review",
  "no-response",
  "medication",
  "checkins",
  "unassigned",
];

function getAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return undefined;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return undefined;
  return Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "VP";
}

function getRiskScore(user: OperationalQueueUser) {
  if (typeof user.riskScore === "number" && user.riskScore > 0) return user.riskScore;

  return computeRiskScore({
    activeAlerts: user.activeAlerts ?? 0,
    checkinEnabled: user.checkinEnabled ?? false,
    criticalAlerts: user.criticalAlerts ?? 0,
    healthConditions: user.healthConditions ?? 0,
    missedMeds7d: user.missedMeds7d ?? 0,
    offlineSensors: user.offlineSensors ?? 0,
  });
}

function deriveStatus(score: number, user: OperationalQueueUser): OperationalStatus {
  if (user.operationalContext?.riskStatus) return user.operationalContext.riskStatus;
  if ((user.criticalAlerts ?? 0) > 0 || score >= 80) return "urgent";
  if ((user.activeAlerts ?? 0) > 0 || (user.missedMeds7d ?? 0) > 0 || !(user.checkinEnabled ?? false)) return "review";
  return "stable";
}

function deriveReasonKey(user: OperationalQueueUser, status: OperationalStatus) {
  if (user.operationalContext?.reasonKey) return user.operationalContext.reasonKey;
  if ((user.missedMeds7d ?? 0) > 0) return "usersList.reason.medication";
  if (!(user.checkinEnabled ?? false)) return "usersList.reason.checkins";
  if ((user.activeAlerts ?? 0) > 0) return status === "urgent" ? "queue.reason.default" : "usersList.reason.review";
  return "usersList.reason.stable";
}

function deriveAction(row: Pick<RiskQueueRow, "status" | "hasNoResponse" | "isUnassigned">): QueueAction {
  if (row.status === "urgent" || row.hasNoResponse) return "call";
  if (row.isUnassigned) return "assign";
  if (row.status === "stable") return "monitor";
  return "review";
}

export function toRiskQueueRow(user: OperationalQueueUser): RiskQueueRow {
  const score = getRiskScore(user);
  const status = deriveStatus(score, user);
  const meta = user.operationalContext;
  const baseRow = {
    id: user.id,
    name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || "Unknown",
    initials: getInitials(user.first_name, user.last_name),
    city: user.city ?? "",
    age: meta?.age ?? getAge(user.date_of_birth),
    score,
    status,
    reasonKey: deriveReasonKey(user, status),
    channel: meta?.preferredChannel ?? "phone",
    lastContactKey: meta?.lastContactKey ?? "usersList.lastContactUnknown",
    assignedTo: meta?.assignedTo,
    hasMedicationIssue: (user.missedMeds7d ?? 0) > 0 || meta?.reasonKey === "usersList.reason.medication",
    hasCheckinIssue: !(user.checkinEnabled ?? false),
    hasNoResponse: Boolean(meta?.noResponse),
    isUnassigned: meta?.assignedTo === null || meta?.assignedTo === undefined,
    livingContextKey: meta?.livingContextKey,
  };

  return {
    ...baseRow,
    action: deriveAction(baseRow),
  };
}

export function deriveRiskQueueRows(users: OperationalQueueUser[]) {
  return users
    .map(toRiskQueueRow)
    .filter(
      (row) =>
        row.status !== "stable" ||
        row.hasNoResponse ||
        row.hasMedicationIssue ||
        row.hasCheckinIssue ||
        row.isUnassigned,
    )
    .sort((a, b) => {
      const statusDelta =
        (a.status === "urgent" ? 0 : a.status === "review" ? 1 : 2) -
        (b.status === "urgent" ? 0 : b.status === "review" ? 1 : 2);
      return statusDelta || b.score - a.score;
    });
}
