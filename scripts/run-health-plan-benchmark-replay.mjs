import {
  buildHealthPlanBenchmarkReplayGate,
  evaluateHealthPlanBenchmarkReplaySuite,
} from "../src/lib/healthPlanBenchmarkReplay.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function printList(title, items = [], formatter = (item) => String(item)) {
  console.log(`\n${title}`);
  if (!Array.isArray(items) || items.length === 0) {
    console.log("  none");
    return;
  }
  for (const item of items) {
    console.log(`  - ${formatter(item)}`);
  }
}

const suite = evaluateHealthPlanBenchmarkReplaySuite();
const strict = hasFlag("--strict");
const json = hasFlag("--json");
const customGate = {
  ...(argValue("--min-average-latest-score") ? { min_average_latest_score: Number(argValue("--min-average-latest-score")) } : {}),
  ...(argValue("--min-track-latest-score") ? { min_track_latest_score: Number(argValue("--min-track-latest-score")) } : {}),
  ...(argValue("--max-regressed-count") ? { max_regressed_count: Number(argValue("--max-regressed-count")) } : {}),
  ...(argValue("--max-guarded-or-fragile-count") ? { max_guarded_or_fragile_count: Number(argValue("--max-guarded-or-fragile-count")) } : {}),
};
const effectiveReleaseGate = Object.keys(customGate).length > 0
  ? buildHealthPlanBenchmarkReplayGate(suite, customGate)
  : suite.release_gate;

if (json) {
  console.log(JSON.stringify({ ...suite, release_gate: effectiveReleaseGate }, null, 2));
  if (strict && effectiveReleaseGate?.passed === false) process.exit(1);
  process.exit(0);
}

console.log("Health plan benchmark replay");
console.log("============================");
console.log(suite.summary);
console.log("");
console.log(`Tracks: ${suite.total_tracks}`);
console.log(`Improved: ${suite.improved_count}`);
console.log(`Regressed: ${suite.regressed_count}`);
console.log(`Guarded or fragile latest tracks: ${suite.guarded_or_fragile_count}`);
console.log(`Average latest score: ${suite.average_latest_score}`);
console.log(`Average score delta: ${suite.average_score_delta}`);
console.log("");
console.log(`Release gate: ${effectiveReleaseGate?.status || "unknown"}`);
if (effectiveReleaseGate?.thresholds) {
  console.log(`Release floor: avg >= ${effectiveReleaseGate.thresholds.min_average_latest_score}, each track >= ${effectiveReleaseGate.thresholds.min_track_latest_score}`);
}

printList("Weakest dimensions", suite.weakest_dimensions, (item) => `${item.id} (${item.count})`);
printList("Recurring issue types", suite.recurring_issue_types, (item) => `${item.id} (${item.count})`);
printList("Weakest tracks", suite.weakest_tracks, (item) => `${item.track_label}: ${item.latest_status} at ${item.latest_score}`);
printList("Blocking reasons", effectiveReleaseGate?.blocking_reasons, (item) => item);
printList("Recommended actions", effectiveReleaseGate?.recommended_actions, (item) => `${item.priority}: ${item.label} - ${item.action_text}`);

if (strict && effectiveReleaseGate?.passed === false) {
  process.exit(1);
}
