import { existsSync } from "node:fs";
import { join } from "node:path";
import { handleOwnerGate } from "../owner-gate.mjs";

/**
 * Runs as Nitro global middleware. `serveStatic` is off in vite.config.ts so
 * this sees dataset and client-bundle requests before a file is sent.
 * Datasets live in server/private, not public/.
 */
export default async function ownerGateMiddleware(
  event: { url?: URL; req?: Request },
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const request = event.req instanceof Request ? event.req : requestFromEvent(event);
  const result = await handleOwnerGate(request, {
    staticRoots: [join(process.cwd(), "public"), join(process.cwd(), ".output", "public")].filter((root) => existsSync(root)),
  });
  if (result.kind === "response") return result.response;
  return next();
}

function requestFromEvent(event: { url?: URL; req?: Request }): Request {
  const headers = new Headers();
  const raw = event.req?.headers;
  if (raw && typeof raw.forEach === "function") raw.forEach((value, key) => headers.set(key, value));
  const url = event.url instanceof URL ? event.url.href : "http://localhost/";
  return new Request(url, { method: event.req?.method ?? "GET", headers });
}
