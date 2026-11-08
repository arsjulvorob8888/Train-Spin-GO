#!/usr/bin/env node
/**
 * Print OWNER_PASSWORD_HASH and OWNER_SESSION_SECRET for the server environment.
 *
 * The password is read from stdin so it is not a shell argument.
 * Nothing is written to disk. Do not commit the output. Do not reuse another
 * site's password.
 *
 *   node scripts/owner-auth-setup.mjs
 *   (type the new password, then Enter)
 */
import { randomBytes } from "node:crypto";
import { hashOwnerPassword } from "../server/owner-gate.mjs";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 12) {
  console.error("Password must be at least 12 characters. Nothing was saved.");
  process.exit(1);
}
const hash = await hashOwnerPassword(password);
const secret = randomBytes(32).toString("hex");
process.stdout.write(
  [
    "Put these in the Render dashboard for train-spin-go, or in a local .env that is not committed.",
    "OWNER_PASSWORD_HASH=" + hash,
    "OWNER_SESSION_SECRET=" + secret,
    "",
  ].join("\n"),
);
