import { sql } from "drizzle-orm";
import { connectDb } from "./index";

export function readSiteLocale(binding: D1Database, code: string) {
  return connectDb(binding).get<{ code: string; langTag: string }>(
    sql`SELECT code, lang_tag AS langTag FROM site_locales WHERE code = ${code}`,
  );
}
