import { readFileSync, writeFileSync } from "node:fs";
import { applyCapture, auditPack, planCapture } from "./mtt-pack.mjs";

const packPath = new URL("../public/mtt-8max.json", import.meta.url);

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function flags(name) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === name && process.argv[i + 1]) out.push(process.argv[i + 1]);
  }
  return out;
}

const pack = JSON.parse(readFileSync(packPath, "utf8"));

if (process.argv.includes("--audit")) {
  const audit = auditPack(pack);
  console.log(JSON.stringify(audit, null, 2));
  process.exit(0);
}

const from = arg("--from");
if (!from) {
  console.error("Usage: node scripts/import-mtt-charts.mjs --audit | --from capture.json [--write] [--replace key] [--terms-reviewed]");
  process.exit(1);
}

const file = JSON.parse(readFileSync(from, "utf8"));
const plan = planCapture(file, pack, {
  replace: flags("--replace"),
  write: process.argv.includes("--write"),
  termsReviewed: process.argv.includes("--terms-reviewed"),
});

const preview = {
  ok: plan.ok,
  writeAllowed: plan.writeAllowed,
  mode: plan.mode,
  errors: plan.errors,
  notes: plan.notes,
  charts: plan.charts.map((chart) => ({
    key: chart.key,
    replaces: chart.replaces,
    raisePct: chart.raisePct ?? null,
    callPct: chart.callPct ?? null,
    allinPct: chart.allinPct ?? null,
    hands: chart.hands ? Object.keys(chart.hands).length : 0,
  })),
};
console.log(JSON.stringify(preview, null, 2));

if (!plan.ok) process.exit(1);
if (!process.argv.includes("--write")) process.exit(0);
if (!plan.writeAllowed) process.exit(2);

const next = applyCapture(pack, plan);
writeFileSync(packPath, JSON.stringify(next));
console.log(`Updated ${plan.charts.length} chart(s). Existing keys were not changed unless --replace named them.`);
