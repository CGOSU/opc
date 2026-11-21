import { connectDb } from "@opc/db";
import { readSiteSettings, saveSiteSettings } from "@opc/db/site-settings";
import { Elysia, t } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { errorResponse } from "../auth/auth.schema";

const metadata = t.Object(
  {
    siteName: t.String({ maxLength: 80 }),
    defaultDescription: t.String({ maxLength: 320 }),
  },
  { additionalProperties: false },
);
const settings = t.Object(
  { zh: metadata, en: metadata },
  { additionalProperties: false },
);

export function settingsRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia()
    .use(adminSecurity(getEnv))
    .get("/api/admin/settings", () => readSiteSettings(db()), {
      requireSession: true,
      response: { 200: settings, 401: errorResponse, 500: errorResponse },
    })
    .put("/api/admin/settings", ({ body }) => saveSiteSettings(db(), body), {
      requireSession: true,
      body: settings,
      response: {
        200: settings,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        500: errorResponse,
      },
    });
}
