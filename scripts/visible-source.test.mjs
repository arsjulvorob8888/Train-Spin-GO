import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const NAME = /gtobase|www\.gtobase\.com/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith(".tsx") || name.endsWith(".jsx")) out.push(path);
  }
  return out;
}

/** Drop comments so file-level notes are not treated as rendered text. */
function rendered(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no component renders a GTObase name or link", () => {
  const hits = [];
  for (const file of walk("src/components")) {
    const text = rendered(readFileSync(file, "utf8"));
    if (NAME.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test("stored pack metadata still names its source", () => {
  const pack = JSON.parse(readFileSync("public/mtt-8max.json", "utf8"));
  assert.match(pack.source, /GTObase\.com/);
  assert.equal(typeof pack.license, "string");
  assert.ok(pack.license.length > 0);
});
