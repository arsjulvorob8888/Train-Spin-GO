import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

export const COOKIE_NAME = "owner_session";
export const SESSION_SECONDS = 60 * 60 * 12;
export const HEALTH_PATH = "/healthz";
export const LOGIN_PATH = "/api/owner/login";
export const LOGOUT_PATH = "/api/owner/logout";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;
const WINDOW_MS = 10 * 60 * 1000;
const IP_LIMIT = 8;
const GLOBAL_LIMIT = 40;
const MAX_BODY = 4096;

/** Files that used to live in public/ and must not be served without a session. */
export const PRIVATE_FILES = {
  "/mtt-8max.json": {
    name: "mtt-8max.json",
    type: "application/json; charset=utf-8",
  },
  "/spin-go-checklist.docx": {
    name: "spin-go-checklist.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "/spin-go-anchors.docx": {
    name: "spin-go-anchors.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

const SETUP_HINT =
  "Owner login is not configured. Set OWNER_PASSWORD_HASH and OWNER_SESSION_SECRET on the server, then restart. " +
  "On your own machine run: node scripts/owner-auth-setup.mjs " +
  "Use a new password that you do not use anywhere else. Do not commit the values.";

/**
 * @param {string} password
 */
export async function hashOwnerPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, SCRYPT);
  return `scrypt:${salt.toString("hex")}:${Buffer.from(key).toString("hex")}`;
}

/**
 * @param {string | undefined} stored
 */
export function hashShapeOk(stored) {
  const parts = String(stored ?? "").split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  if (!/^[0-9a-f]{32}$/i.test(parts[1])) return false;
  if (!/^[0-9a-f]{64}$/i.test(parts[2])) return false;
  return true;
}

/**
 * @param {string} password
 * @param {string} stored
 */
export async function passwordMatches(password, stored) {
  if (!hashShapeOk(stored)) return false;
  const [, saltHex, hashHex] = stored.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const key = Buffer.from(await scrypt(password, salt, KEYLEN, SCRYPT));
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

/**
 * @param {string} secret
 * @param {number} now
 */
export function issueSession(secret, now) {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const body = `v1.${exp}.${nonce}`;
  const mac = createHmac("sha256", secret).update(body).digest("hex");
  return `${body}.${mac}`;
}

/**
 * @param {string} token
 * @param {string} secret
 * @param {number} now
 */
export function sessionValid(token, secret, now) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  if (!/^[0-9a-f]{64}$/i.test(parts[3])) return false;
  const body = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const mac = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(parts[3], "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp)) return false;
  return exp * 1000 > now;
}

export function createAttemptLog() {
  /** @type {{ ip: string, at: number }[]} */
  const hits = [];
  return {
    /**
     * @param {string} ip
     * @param {number} now
     */
    tooMany(ip, now) {
      const fresh = hits.filter((hit) => now - hit.at < WINDOW_MS);
      hits.length = 0;
      hits.push(...fresh);
      const mine = hits.filter((hit) => hit.ip === ip).length;
      return mine >= IP_LIMIT || hits.length >= GLOBAL_LIMIT;
    },
    /**
     * @param {string} ip
     * @param {number} now
     */
    add(ip, now) {
      hits.push({ ip, at: now });
    },
  };
}

/**
 * @param {string} header
 * @param {string} name
 */
export function readCookie(header, name) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Collapse a URL path. `..`, bad escapes, and NUL reject the request.
 * @param {string} raw
 * @returns {string | null}
 */
export function safePath(raw) {
  let decoded = raw || "/";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  const segments = [];
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

/**
 * @param {string} root
 * @param {string} requestPath
 */
export function resolveInside(root, requestPath) {
  const path = safePath(requestPath);
  if (!path || path.endsWith(".map")) return null;
  let rootReal;
  try {
    rootReal = realpathSync(root);
  } catch {
    return null;
  }
  const full = join(rootReal, ...path.split("/").filter(Boolean));
  let fullReal;
  try {
    fullReal = realpathSync(full);
  } catch {
    return null;
  }
  if (fullReal !== rootReal && !fullReal.startsWith(rootReal + sep)) return null;
  try {
    if (!statSync(fullReal).isFile()) return null;
  } catch {
    return null;
  }
  return fullReal;
}

/**
 * @param {NodeJS.ProcessEnv} env
 */
export function authConfig(env) {
  const hash = env.OWNER_PASSWORD_HASH?.trim() ?? "";
  const secret = env.OWNER_SESSION_SECRET?.trim() ?? "";
  if (!hash || !secret || secret.length < 32 || !hashShapeOk(hash)) return null;
  return { hash, secret };
}

/**
 * @param {boolean} secure
 * @param {string} token
 * @param {number} maxAge
 */
export function sessionCookie(secure, token, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * @param {string} message
 */
function loginHtml(message) {
  const note = message ? `<p class="err">${escapeHtml(message)}</p>` : "";
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Вход — Spin Drill</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0c0d0b; color: #f4f1ea; font: 16px/1.45 "IBM Plex Sans", sans-serif; }
  main { width: min(24rem, calc(100% - 2rem)); }
  h1 { font-size: 1.6rem; margin: 0 0 0.5rem; }
  p { color: #b7b1a6; }
  form { display: grid; gap: 0.75rem; margin-top: 1.25rem; }
  input { font: inherit; padding: 0.7rem 0.8rem; border-radius: 0.6rem; border: 1px solid #3a3a34; background: #161713; color: inherit; }
  button { font: inherit; padding: 0.7rem 0.8rem; border: 0; border-radius: 999px; background: #d6ff4a; color: #14160f; font-weight: 600; }
  .err { color: #ffb4a8; }
</style>
</head>
<body>
<main>
  <h1>Личный тренажёр</h1>
  <p>Это закрытое приложение. Войти может только владелец. Регистрации нет.</p>
  ${note}
  <form method="post" action="${LOGIN_PATH}">
    <label>Пароль
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button type="submit">Войти</button>
  </form>
</main>
</body>
</html>`;
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}

/**
 * @param {number} status
 * @param {string} html
 * @param {string[]} [cookies]
 */
function html(status, htmlBody, cookies = []) {
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(htmlBody, { status, headers });
}

/**
 * @param {number} status
 * @param {string} body
 * @param {string} type
 * @param {string[]} [cookies]
 */
function text(status, body, type, cookies = []) {
  const headers = new Headers({
    "content-type": type,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
    "x-content-type-options": "nosniff",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(body, { status, headers });
}

/**
 * @param {Headers} headers
 */
function clientIp(headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  return "unknown";
}

/**
 * @param {Request} request
 */
function wantsSecureCookie(request) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

/**
 * @param {string} body
 * @param {string} contentType
 */
function passwordFromBody(body, contentType) {
  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(body);
      return typeof parsed?.password === "string" ? parsed.password : "";
    } catch {
      return "";
    }
  }
  return new URLSearchParams(body).get("password") ?? "";
}

/**
 * @param {Request} request
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   now?: () => number,
 *   attempts?: ReturnType<typeof createAttemptLog>,
 *   readPrivate?: (name: string) => Buffer | null,
 *   staticRoots?: string[],
 * }} [deps]
 * @returns {Promise<{ kind: "response", response: Response } | { kind: "continue", path: string }>}
 */
export async function handleOwnerGate(request, deps = {}) {
  const env = deps.env ?? process.env;
  const now = deps.now ? deps.now() : Date.now();
  const attempts = deps.attempts ?? sharedAttempts;
  const url = new URL(request.url);
  const path = safePath(url.pathname);
  const method = request.method.toUpperCase();
  const secure = wantsSecureCookie(request);

  if (path === null) {
    return { kind: "response", response: text(400, "Bad request", "text/plain; charset=utf-8") };
  }

  if (method === "GET" || method === "HEAD") {
    if (path === HEALTH_PATH) {
      const body = method === "HEAD" ? null : '{"ok":true}';
      return {
        kind: "response",
        response: new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        }),
      };
    }
  }

  const config = authConfig(env);
  if (!config) {
    return { kind: "response", response: text(503, SETUP_HINT, "text/plain; charset=utf-8") };
  }

  const token = readCookie(request.headers.get("cookie") ?? "", COOKIE_NAME);
  const authed = sessionValid(token, config.secret, now);
  const clear = authed ? [] : token ? [sessionCookie(secure, "", 0)] : [];

  if (method === "POST" && path === LOGOUT_PATH) {
    if (!authed) return { kind: "response", response: html(401, loginHtml(""), clear) };
    return { kind: "response", response: redirect("/", [sessionCookie(secure, "", 0)]) };
  }

  if (method === "POST" && path === LOGIN_PATH) {
    const ip = clientIp(request.headers);
    if (attempts.tooMany(ip, now)) {
      return { kind: "response", response: html(429, loginHtml("Слишком много попыток. Подождите и попробуйте снова.")) };
    }
    const origin = request.headers.get("origin");
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host)
      .split(",")[0]
      .trim();
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        return { kind: "response", response: text(403, "Forbidden", "text/plain; charset=utf-8") };
      }
      if (originHost !== host) {
        return { kind: "response", response: text(403, "Forbidden", "text/plain; charset=utf-8") };
      }
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return { kind: "response", response: html(413, loginHtml("Запрос слишком большой.")) };
    }
    const password = passwordFromBody(raw, request.headers.get("content-type") ?? "");
    const ok = await passwordMatches(password, config.hash);
    if (!ok) {
      attempts.add(ip, now);
      return { kind: "response", response: html(401, loginHtml("Неверный пароль.")) };
    }
    const session = issueSession(config.secret, now);
    return { kind: "response", response: redirect("/", [sessionCookie(secure, session, SESSION_SECONDS)]) };
  }

  if (!authed) {
    if (isDataRequest(path, request.headers.get("accept"))) {
      return { kind: "response", response: text(401, '{"error":"unauthorized"}', "application/json; charset=utf-8", clear) };
    }
    return { kind: "response", response: html(401, loginHtml(""), clear) };
  }

  const privateFile = PRIVATE_FILES[path];
  if (privateFile && (method === "GET" || method === "HEAD")) {
    const bytes = deps.readPrivate ? deps.readPrivate(privateFile.name) : readPrivateFromDisk(privateFile.name);
    if (!bytes) return { kind: "response", response: text(404, "Not found", "text/plain; charset=utf-8") };
    return {
      kind: "response",
      response: new Response(method === "HEAD" ? null : bytes, {
        status: 200,
        headers: {
          "content-type": privateFile.type,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          ...(privateFile.name.endsWith(".docx")
            ? { "content-disposition": `attachment; filename="${privateFile.name}"` }
            : {}),
        },
      }),
    };
  }

  for (const root of deps.staticRoots ?? []) {
    if (method !== "GET" && method !== "HEAD") break;
    const file = resolveInside(root, path);
    if (!file) continue;
    const bytes = readFileSync(file);
    return {
      kind: "response",
      response: new Response(method === "HEAD" ? null : bytes, {
        status: 200,
        headers: {
          "content-type": contentType(file),
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      }),
    };
  }

  return { kind: "continue", path };
}

const sharedAttempts = createAttemptLog();

/**
 * Vite dev middleware. Registered before Vite's static handler so public files
 * and transformed modules are not sent until the owner session is valid.
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next: () => void) => Promise<void>}
 */
export function connectOwnerGate() {
  return async (req, res, next) => {
    try {
      const method = (req.method ?? "GET").toUpperCase();
      const host = req.headers.host || "localhost";
      const url = `http://${host}${req.url ?? "/"}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (/^(host|connection|content-length|transfer-encoding)$/i.test(key)) continue;
        headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
      }
      const path = safePath((req.url ?? "/").split("?", 1)[0] ?? "/");
      const body = method === "POST" && path === LOGIN_PATH ? await readNodeBody(req) : undefined;
      const request = new Request(url, { method, headers, body });
      const result = await handleOwnerGate(request);
      if (result.kind === "continue") {
        next();
        return;
      }
      await writeNodeResponse(res, result.response);
    } catch (error) {
      console.error("[owner-gate]", error instanceof Error ? error.message : "failed");
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("owner gate failed");
      }
    }
  };
}

/**
 * @param {import("node:http").IncomingMessage} req
 */
function readNodeBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        resolve("");
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {Response} response
 */
async function writeNodeResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  if (cookies.length) res.setHeader("set-cookie", cookies);
  const bytes = Buffer.from(await response.arrayBuffer());
  res.end(bytes);
}

/**
 * @param {string} name
 */
function readPrivateFromDisk(name) {
  if (!Object.values(PRIVATE_FILES).some((file) => file.name === name)) return null;
  try {
    return readFileSync(join(process.cwd(), "server", "private", name));
  } catch {
    return null;
  }
}

/**
 * @param {string} path
 * @param {string | null} accept
 */
function isDataRequest(path, accept) {
  if (PRIVATE_FILES[path]) return true;
  if (path.startsWith("/api/") || path.startsWith("/assets/") || path.startsWith("/_server") || path.startsWith("/__grok")) return true;
  if (/\.(json|docx|js|mjs|css|map|wasm|txt|xml|webmanifest)$/i.test(path)) return true;
  if (accept && !accept.includes("text/html") && !accept.includes("*/*")) return true;
  return false;
}

/**
 * @param {string} file
 */
function contentType(file) {
  if (file.endsWith(".js") || file.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".json")) return "application/json; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

/**
 * @param {Request} request
 * @param {string} [path]
 */
/**
 * @param {string} location
 * @param {string[]} cookies
 */
function redirect(location, cookies) {
  const headers = new Headers({
    location,
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}
