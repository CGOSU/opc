import { connectDb } from "@opc/db";
import { readDashboard } from "@opc/db/dashboard";
import { Elysia, t } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { errorResponse } from "../auth/auth.schema";
import { localeSchema } from "../posts/posts.schema";

const count = t.Integer({ minimum: 0 });
const activity = {
  id: t.String(),
  title: t.String(),
  timestamp: t.String({ format: "date-time" }),
};
const dashboardResponse = t.Object({
  counts: t.Object({
    posts: count,
    topics: count,
    categories: count,
    tags: count,
  }),
  recentPosts: t.Array(t.Object({ ...activity, locale: localeSchema }), {
    maxItems: 5,
  }),
  recentTopics: t.Array(t.Object(activity), { maxItems: 5 }),
});

export function dashboardRoutes(getEnv: () => Cloudflare.Env) {
  return new Elysia()
    .use(adminSecurity(getEnv))
    .get(
      "/api/admin/dashboard",
      () => readDashboard(connectDb(getEnv().CONTENT)),
      {
        requireSession: true,
        response: {
          200: dashboardResponse,
          401: errorResponse,
          500: errorResponse,
        },
      },
    );
}
