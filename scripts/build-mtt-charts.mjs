import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/tmp/phr/gto-preflop/mtt/8max/charts";
const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8"));
const charts = {};

function encode(actions) {
  const parts = [];
  for (const [key, letter] of [
    ["allin", "a"],
    ["raise", "r"],
    ["call", "c"],
  ]) {
    const value = actions[key] || 0;
    if (value >= 0.995) return letter;
    if (value >= 0.005) parts.push(letter + Math.round(value * 100));
  }
  return parts.join("");
}

for (const chart of index.charts) {
  const file = JSON.parse(readFileSync(join(root, chart.path), "utf8"));
  const hands = {};
  for (const [hand, actions] of Object.entries(file.actions)) {
    const code = encode(actions);
    if (code) hands[hand] = code;
  }
  charts[`${chart.stack_bb}:${chart.scenario}:${chart.name}`] = hands;
}

const stacks = [...new Set(index.charts.map((chart) => chart.stack_bb))].sort((a, b) => b - a);
const out = {
  source: "https://github.com/matthiola0/poker-hand-review",
  license: "MIT",
  set: "mtt/8max",
  stacks,
  charts,
};
writeFileSync(new URL("../public/mtt-8max.json", import.meta.url), JSON.stringify(out));
console.log("charts", Object.keys(charts).length, "stacks", stacks.join(","));
