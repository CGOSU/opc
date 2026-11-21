import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const admins = sqliteTable(
  "admins",
  {
    id: text().primaryKey().notNull(),
    singleton: integer().notNull().default(1).unique(),
    username: text().notNull().unique(),
    passwordHash: text("password_hash").notNull(),
  },
  (table) => [
    check("admins_singleton", sql`${table.singleton} = 1`),
    check(
      "admins_username_format",
      sql`length(${table.username}) BETWEEN 4 AND 32 AND ${table.username} NOT GLOB '*[^A-Za-z0-9_]*'`,
    ),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey().notNull(),
    adminId: text("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    index("sessions_admin_id_idx").on(table.adminId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const adminLoginLimits = sqliteTable(
  "admin_login_limits",
  {
    clientKey: text("client_key").primaryKey().notNull(),
    attempts: integer().notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (table) => [
    check("admin_login_limits_positive_attempts", sql`${table.attempts} > 0`),
    index("admin_login_limits_expires_at_idx").on(table.expiresAt),
  ],
);
