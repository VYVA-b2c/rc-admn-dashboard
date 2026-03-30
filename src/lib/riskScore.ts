export interface RiskInput {
  criticalAlerts: number;
  activeAlerts: number;
  missedMeds7d: number;
  checkinEnabled: boolean;
  offlineSensors: number;
  healthConditions: number;
}

export function computeRiskScore(input: RiskInput): number {
  let score = 0;

  // Critical alerts: +30 each, cap 60
  score += Math.min(input.criticalAlerts * 30, 60);

  // Warning/active alerts (non-critical): +15 each, cap 30
  const warningAlerts = Math.max(input.activeAlerts - input.criticalAlerts, 0);
  score += Math.min(warningAlerts * 15, 30);

  // Missed medications in last 7 days: +5 each, cap 20
  score += Math.min(input.missedMeds7d * 5, 20);

  // Check-ins disabled: +10
  if (!input.checkinEnabled) score += 10;

  // Offline sensors: +5 each, cap 15
  score += Math.min(input.offlineSensors * 5, 15);

  // Health conditions: 3+ gives +10
  if (input.healthConditions >= 3) score += 10;

  return Math.min(score, 100);
}

export type RiskBand = "high" | "moderate" | "low" | "stable";

export function getRiskBand(score: number): RiskBand {
  if (score >= 80) return "high";
  if (score >= 50) return "moderate";
  if (score >= 20) return "low";
  return "stable";
}

export function getRiskColor(score: number): string {
  const band = getRiskBand(score);
  switch (band) {
    case "high": return "hsl(0, 72%, 51%)";       // red
    case "moderate": return "hsl(24, 94%, 53%)";   // orange
    case "low": return "hsl(45, 96%, 53%)";        // yellow
    case "stable": return "hsl(142, 71%, 45%)";    // green
  }
}

export function getRiskLabel(score: number): string {
  const band = getRiskBand(score);
  switch (band) {
    case "high": return "High Risk";
    case "moderate": return "Moderate";
    case "low": return "Low";
    case "stable": return "Stable";
  }
}

export function getRiskBadgeClasses(score: number): string {
  const band = getRiskBand(score);
  switch (band) {
    case "high": return "bg-destructive text-destructive-foreground";
    case "moderate": return "bg-[hsl(24,94%,53%)] text-white";
    case "low": return "bg-[hsl(45,96%,53%)] text-black";
    case "stable": return "bg-[hsl(142,71%,45%)] text-white";
  }
}
