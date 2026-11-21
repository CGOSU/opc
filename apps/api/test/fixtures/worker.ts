import { env } from "cloudflare:workers";
import { readSiteLocale } from "@opc/db/locales";
import { t } from "elysia";
import { createApp } from "../../src/app";

const app = createApp(() => env).get(
  "/_integration/locales/:code",
  async ({ params, status }) => {
    const locale = await readSiteLocale(env.CONTENT, params.code);
    if (!locale) {
      return status(404, {
        error: { code: "LOCALE_NOT_FOUND", message: "Locale not found." },
      });
    }
    return locale;
  },
  {
    params: t.Object({ code: t.String({ pattern: "^[a-z]{2}$" }) }),
    response: {
      200: t.Object({ code: t.String(), langTag: t.String({ minLength: 2 }) }),
      404: t.Object({
        error: t.Object({
          code: t.Literal("LOCALE_NOT_FOUND"),
          message: t.String(),
        }),
      }),
    },
  },
);

export type ProbeApp = typeof app;
export default app.compile();
