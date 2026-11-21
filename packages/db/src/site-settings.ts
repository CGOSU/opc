import { sql } from "drizzle-orm";
import type { connectDb } from "./index";

type Db = ReturnType<typeof connectDb>;
type Metadata = { siteName: string; defaultDescription: string };
type SiteSettings = { zh: Metadata; en: Metadata };

export async function readSiteSettings(db: Db): Promise<SiteSettings> {
  const rows = await db.all<Metadata & { locale: string }>(sql`
    SELECT locale, site_name AS siteName, default_description AS defaultDescription
    FROM site_settings WHERE locale IN ('zh', 'en')
  `);
  const readLocale = (locale: "zh" | "en"): Metadata => {
    const row = rows.find((entry) => entry.locale === locale);
    return {
      siteName: row?.siteName ?? "",
      defaultDescription: row?.defaultDescription ?? "",
    };
  };
  return { zh: readLocale("zh"), en: readLocale("en") };
}

export async function saveSiteSettings(
  db: Db,
  settings: SiteSettings,
): Promise<SiteSettings> {
  const normalize = (metadata: Metadata): Metadata => ({
    siteName: metadata.siteName.trim(),
    defaultDescription: metadata.defaultDescription.trim(),
  });
  const zh = normalize(settings.zh);
  const en = normalize(settings.en);
  await db.run(sql`
    INSERT INTO site_settings (locale, site_name, default_description) VALUES
      ('zh', ${zh.siteName}, ${zh.defaultDescription}),
      ('en', ${en.siteName}, ${en.defaultDescription})
    ON CONFLICT (locale) DO UPDATE SET
      site_name = excluded.site_name, default_description = excluded.default_description
  `);
  return { zh, en };
}
