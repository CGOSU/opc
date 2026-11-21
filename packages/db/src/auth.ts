import { and, eq, gt, lt, lte, sql } from "drizzle-orm";
import { connectDb } from "./index.ts";
import { adminLoginLimits, admins, sessions } from "./auth-schema.ts";

type Db = ReturnType<typeof connectDb>;

export function createAdmin(db: Db, username: string, passwordHash: string) {
  return db
    .insert(admins)
    .values({ id: crypto.randomUUID(), username, passwordHash })
    .onConflictDoNothing({ target: admins.singleton })
    .returning({ id: admins.id })
    .get();
}

export function findAdmin(db: Db, username: string) {
  return db
    .select({
      id: admins.id,
      username: admins.username,
      passwordHash: admins.passwordHash,
    })
    .from(admins)
    .where(eq(admins.username, username))
    .get();
}

export async function reserveLoginAttempt(
  db: Db,
  clientKey: string,
  now: number,
  window: number,
  limit: number,
) {
  // Atomic across requests; do not increment counts that already reached the limit.
  const [, reservation] = await db.batch([
    db.delete(adminLoginLimits).where(lte(adminLoginLimits.expiresAt, now)),
    db
      .insert(adminLoginLimits)
      .values({ clientKey, attempts: 1, expiresAt: now + window })
      .onConflictDoUpdate({
        target: adminLoginLimits.clientKey,
        set: { attempts: sql`${adminLoginLimits.attempts} + 1` },
        setWhere: lt(adminLoginLimits.attempts, limit),
      })
      .returning({ attempts: adminLoginLimits.attempts }),
  ]);
  return reservation.length > 0;
}

export async function createSession(
  db: Db,
  adminId: string,
  tokenHash: string,
  now: number,
  expiresAt: number,
) {
  await db.batch([
    db.delete(sessions).where(lte(sessions.expiresAt, now)),
    db.insert(sessions).values({ adminId, tokenHash, expiresAt }),
  ]);
}

export function findSession(db: Db, tokenHash: string, now: number) {
  return db
    .select({ id: admins.id, username: admins.username })
    .from(sessions)
    .innerJoin(admins, eq(sessions.adminId, admins.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .get();
}

export async function deleteSession(db: Db, tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
