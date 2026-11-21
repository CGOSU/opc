import { connectDb } from "@opc/db";
import {
  createSession,
  deleteSession,
  findAdmin,
  findSession,
  reserveLoginAttempt,
} from "@opc/db/auth";
import { verifyPassword } from "./password";

export const SESSION_SECONDS = 8 * 60 * 60;
export const LOGIN_WINDOW_SECONDS = 5 * 60;
export const MAX_LOGIN_ATTEMPTS = 8;
const encoder = new TextEncoder();
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function login(
  binding: D1Database,
  credentials: { username: string; password: string },
  ip: string,
) {
  const db = connectDb(binding);
  const now = Date.now();
  const clientKey = await digest(ip);
  if (
    !(await reserveLoginAttempt(
      db,
      clientKey,
      now,
      LOGIN_WINDOW_SECONDS * 1000,
      MAX_LOGIN_ATTEMPTS,
    ))
  ) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts. Try again in a few minutes.",
    } as const;
  }

  const admin = await findAdmin(db, credentials.username);
  const valid = await verifyPassword(credentials.password, admin?.passwordHash);
  if (!admin || !valid) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect username or password.",
    } as const;
  }

  const token = btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  await createSession(
    db,
    admin.id,
    await digest(token),
    now,
    now + SESSION_SECONDS * 1000,
  );
  return {
    ok: true,
    value: { token, identity: { id: admin.id, username: admin.username } },
  } as const;
}

export async function readIdentity(binding: D1Database, token: unknown) {
  if (!isSessionToken(token)) return undefined;
  return findSession(connectDb(binding), await digest(token), Date.now());
}

export async function revokeSession(binding: D1Database, token: unknown) {
  if (!isSessionToken(token)) return;
  await deleteSession(connectDb(binding), await digest(token));
}

function isSessionToken(token: unknown): token is string {
  return typeof token === "string" && tokenPattern.test(token);
}

async function digest(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
