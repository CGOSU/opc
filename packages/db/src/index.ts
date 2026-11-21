import { drizzle } from "drizzle-orm/d1";

export function connectDb(binding: D1Database) {
  return drizzle(binding);
}
