import { Elysia, t } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { authRoutes } from "./modules/auth/auth.routes";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes";
import { mediaRoutes, publicMediaRoutes } from "./modules/media/media.routes";
import { postRoutes } from "./modules/posts/posts.routes";
import { publicRoutes } from "./modules/public/public.routes";
import { settingsRoutes } from "./modules/settings/settings.routes";
import { publicTopicRoutes, topicRoutes } from "./modules/topics/topics.routes";
import { categoryRoutes, tagRoutes } from "./modules/taxonomy/taxonomy.routes";

export function createApp(getEnv: () => Cloudflare.Env) {
  return (
    new Elysia({ adapter: CloudflareAdapter })
      .onRequest(({ request, set }) => {
        if (new URL(request.url).pathname.startsWith("/api/admin/")) {
          set.headers["Cache-Control"] = "no-store";
        }
      })
      .onError(({ code, error, status }) => {
        if (code === "NOT_FOUND") {
          return status(404, {
            error: { code: "NOT_FOUND", message: "Route not found." },
          });
        }
        if (
          code === "PARSE" ||
          (code === "VALIDATION" && error.type !== "response")
        ) {
          return status(400, {
            error: { code: "INVALID_REQUEST", message: "Invalid request." },
          });
        }
        return status(500, {
          error: { code: "INTERNAL_ERROR", message: "Internal server error." },
        });
      })
      // Liveness only; this route never queries D1.
      .get(
        "/health",
        ({ status }) =>
          status(200, { status: "ok", service: "opc-api", check: "liveness" }),
        {
          response: t.Object({
            status: t.Literal("ok"),
            service: t.Literal("opc-api"),
            check: t.Literal("liveness"),
          }),
        },
      )
      .use(authRoutes(getEnv))
      .use(dashboardRoutes(getEnv))
      .use(settingsRoutes(getEnv))
      .use(categoryRoutes(getEnv))
      .use(tagRoutes(getEnv))
      .use(postRoutes(getEnv))
      .use(topicRoutes(getEnv))
      .use(mediaRoutes(getEnv))
      .use(publicMediaRoutes(getEnv))
      .use(publicTopicRoutes(getEnv))
      .use(publicRoutes(getEnv))
  );
}

export type App = ReturnType<typeof createApp>;
