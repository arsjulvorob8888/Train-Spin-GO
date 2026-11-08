import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  COOKIE_NAME,
  HEALTH_PATH,
  LOGIN_PATH,
  LOGOUT_PATH,
  SESSION_SECONDS,
  createAttemptLog,
  handleOwnerGate,
  hashOwnerPassword,
  issueSession,
  passwordMatches,
  readCookie,
  safePath,
} from "../server/owner-gate.mjs";

const NOW = 1_700_000_000_000;
const PASSWORD = "correct-horse-battery";
const SECRET = "test-only-session-secret-32chars";

function env(hash) {
  return { OWNER_PASSWORD_HASH: hash, OWNER_SESSION_SECRET: SECRET };
}

async function send(path, { method = "GET", headers = {}, body, hash, now = NOW, attempts, readPrivate, staticRoots } = {}) {
  const request = new Request(`https://train.example${path}`, {
    method,
    headers,
    body,
  });
  const result = await handleOwnerGate(request, {
    env: hash === undefined ? {} : env(hash),
    now: () => now,
    attempts: attempts ?? createAttemptLog(),
    readPrivate,
    staticRoots,
  });
  assert.equal(result.kind, "response");
  return result.response;
}

test("password hash verifies only the same password", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  assert.equal(await passwordMatches(PASSWORD, hash), true);
  assert.equal(await passwordMatches("correct-horse-batterz", hash), false);
  assert.equal(await passwordMatches("", hash), false);
});

test("missing configuration fails closed and health stays minimal", async () => {
  let reads = 0;
  const page = await send("/", {
    headers: { accept: "text/html" },
    readPrivate() {
      reads += 1;
      return Buffer.from("secret-range");
    },
  });
  assert.equal(page.status, 503);
  const text = await page.text();
  assert.match(text, /OWNER_PASSWORD_HASH/);
  assert.match(text, /OWNER_SESSION_SECRET/);
  assert.doesNotMatch(text, /scrypt:/);
  assert.equal(reads, 0);

  const data = await send("/mtt-8max.json", {
    readPrivate() {
      reads += 1;
      return Buffer.from('{"charts":{}}');
    },
  });
  assert.equal(data.status, 503);
  assert.doesNotMatch(await data.text(), /charts/);
  assert.equal(reads, 0);

  const health = await send(HEALTH_PATH);
  assert.equal(health.status, 200);
  assert.equal(await health.text(), '{"ok":true}');
  assert.equal(health.headers.get("cache-control"), "no-store");
});

test("unauthenticated html, ranges, assets, and apis stay closed", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  let reads = 0;
  const readPrivate = () => {
    reads += 1;
    return Buffer.from('{"charts":{"40:rfi:UTG":{"AA":"r"}}}');
  };
  const html = await send("/", { hash, headers: { accept: "text/html" }, readPrivate });
  assert.equal(html.status, 401);
  const page = await html.text();
  assert.match(page, /Регистрации нет/);
  assert.match(page, /Личный тренажёр/);
  assert.doesNotMatch(page, /<script/i);
  assert.doesNotMatch(page, /charts/);
  assert.doesNotMatch(page, /AKs/);

  const json = await send("/mtt-8max.json", { hash, readPrivate });
  assert.equal(json.status, 401);
  assert.equal(await json.text(), '{"error":"unauthorized"}');
  assert.equal(json.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(json.headers.get("cache-control"), "private, no-store");

  const docx = await send("/spin-go-checklist.docx", { hash, readPrivate });
  assert.equal(docx.status, 401);
  const asset = await send("/assets/index-abc123.js", { hash, readPrivate });
  assert.equal(asset.status, 401);
  assert.equal(await asset.text(), '{"error":"unauthorized"}');
  const api = await send("/api/auth/get-session", { hash, readPrivate });
  assert.equal(api.status, 401);
  assert.equal(reads, 0);
});

test("valid password sets a hardened cookie and then serves the private range", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  const attempts = createAttemptLog();
  const login = await send(LOGIN_PATH, {
    method: "POST",
    hash,
    attempts,
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://train.example" },
    body: new URLSearchParams({ password: PASSWORD }),
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/");
  const setCookie = login.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const token = readCookie(setCookie, COOKIE_NAME);
  assert.ok(token);

  const range = Buffer.from('{"source":"fixture","charts":{}}');
  let reads = 0;
  const opened = await send("/mtt-8max.json", {
    hash,
    attempts,
    headers: { cookie: `${COOKIE_NAME}=${token}` },
    readPrivate(name) {
      reads += 1;
      assert.equal(name, "mtt-8max.json");
      return range;
    },
  });
  assert.equal(opened.status, 200);
  assert.equal(await opened.text(), range.toString("utf8"));
  assert.equal(opened.headers.get("cache-control"), "private, no-store");
  assert.equal(reads, 1);

  const app = await handleOwnerGate(new Request("https://train.example/", { headers: { cookie: `${COOKIE_NAME}=${token}`, accept: "text/html" } }), {
    env: env(hash),
    now: () => NOW,
    attempts,
    readPrivate() {
      throw new Error("app shell must not read ranges");
    },
  });
  assert.equal(app.kind, "continue");
});

test("wrong password, logout, expiry, and a forged cookie do not open ranges", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  const attempts = createAttemptLog();
  const bad = await send(LOGIN_PATH, {
    method: "POST",
    hash,
    attempts,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "password=not-the-password",
  });
  assert.equal(bad.status, 401);
  assert.match(await bad.text(), /Неверный пароль/);
  assert.equal(bad.headers.get("set-cookie"), null);

  const token = issueSession(SECRET, NOW);
  const logout = await send(LOGOUT_PATH, {
    method: "POST",
    hash,
    attempts,
    headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(token)}` },
  });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/);

  const expired = await send("/mtt-8max.json", {
    hash,
    now: NOW + SESSION_SECONDS * 1000 + 1000,
    headers: { cookie: `${COOKIE_NAME}=${token}` },
    readPrivate() {
      throw new Error("expired session read the range");
    },
  });
  assert.equal(expired.status, 401);

  const forged = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  const fake = await send("/mtt-8max.json", {
    hash,
    headers: { cookie: `${COOKIE_NAME}=${forged}` },
    readPrivate() {
      throw new Error("forged cookie read the range");
    },
  });
  assert.equal(fake.status, 401);
  assert.equal(await fake.text(), '{"error":"unauthorized"}');
});

test("login attempts are throttled", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  const attempts = createAttemptLog();
  for (let i = 0; i < 8; i++) {
    const res = await send(LOGIN_PATH, {
      method: "POST",
      hash,
      attempts,
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify({ password: "wrong-password" }),
    });
    assert.equal(res.status, 401);
  }
  const blocked = await send(LOGIN_PATH, {
    method: "POST",
    hash,
    attempts,
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(blocked.status, 429);
});

test("path traversal and foreign origins do not return private files", async () => {
  const hash = await hashOwnerPassword(PASSWORD);
  const token = issueSession(SECRET, NOW);
  const root = mkdtempSync(join(tmpdir(), "owner-static-"));
  mkdirSync(join(root, "nested"));
  writeFileSync(join(root, "nested", "note.txt"), "public-note");
  const outside = mkdtempSync(join(tmpdir(), "owner-outside-"));
  writeFileSync(join(outside, "secret.txt"), "outside-secret");

  assert.equal(safePath("/%2e%2e/server/private/mtt-8max.json"), null);
  assert.equal(safePath("/mtt-8max.json/../../etc/passwd"), null);
  const traversed = await handleOwnerGate(
    new Request(`https://train.example${encodeURI("/mtt-8max.json/../../etc/passwd")}`),
    {
      env: env(hash),
      now: () => NOW,
      attempts: createAttemptLog(),
      staticRoots: [root],
      readPrivate() {
        throw new Error("traversal read a private file");
      },
    },
  );
  if (traversed.kind === "response") {
    assert.notEqual(traversed.response.status, 200);
    assert.doesNotMatch(await traversed.response.text(), /charts|outside-secret|public-note/);
  }

  symlinkSync(join(outside, "secret.txt"), join(root, "leak.txt"));
  const linked = await handleOwnerGate(new Request("https://train.example/leak.txt", { headers: { cookie: `${COOKIE_NAME}=${token}` } }), {
    env: env(hash),
    now: () => NOW,
    attempts: createAttemptLog(),
    staticRoots: [root],
  });
  if (linked.kind === "response") {
    assert.doesNotMatch(await linked.response.text(), /outside-secret/);
  }

  const ok = await send("/nested/note.txt", {
    hash,
    headers: { cookie: `${COOKIE_NAME}=${token}` },
    staticRoots: [root],
  });
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "public-note");

  const cross = await send(LOGIN_PATH, {
    method: "POST",
    hash,
    headers: { origin: "https://evil.example", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: PASSWORD }),
  });
  assert.equal(cross.status, 403);
});

test("datasets are not in public/ and an http cookie omits Secure", async () => {
  assert.equal(existsSync(new URL("../public/mtt-8max.json", import.meta.url)), false);
  assert.equal(existsSync(new URL("../server/private/mtt-8max.json", import.meta.url)), true);
  assert.match(readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8"), /serveStatic:\s*false/);
  const setup = spawnSync(process.execPath, ["scripts/owner-auth-setup.mjs"], { input: "short\n", encoding: "utf8" });
  assert.equal(setup.status, 1);
  assert.doesNotMatch(setup.stdout ?? "", /scrypt:/);
  const hash = await hashOwnerPassword(PASSWORD);
  const request = new Request("http://127.0.0.1:8080/api/owner/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: PASSWORD }),
  });
  const result = await handleOwnerGate(request, { env: env(hash), now: () => NOW, attempts: createAttemptLog() });
  assert.equal(result.kind, "response");
  const cookie = result.response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /HttpOnly/);
  assert.doesNotMatch(cookie, /Secure/);
});
