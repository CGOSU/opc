import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { connectDb } from "./index";

const dialect = new SQLiteSyncDialect();

// Drizzle's batch API does not accept raw SQL expressions.
export function d1Batch(db: ReturnType<typeof connectDb>, statements: SQL[]) {
  return db.$client.batch(
    statements.map((statement) => {
      const { sql, params } = dialect.sqlToQuery(statement);
      return db.$client.prepare(sql).bind(...params);
    }),
  );
}

export function d1ErrorMessage(error: unknown) {
  return error instanceof Error && error.cause instanceof Error
    ? error.cause.message
    : String(error);
}
