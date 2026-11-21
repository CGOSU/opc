import { Elysia, t } from "elysia";
import {
  adminSecurity,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../../plugins/admin-security";
import { errorResponse, identityResponse, loginBody } from "./auth.schema";
import {
  login,
  LOGIN_WINDOW_SECONDS,
  revokeSession,
  SESSION_SECONDS,
} from "./auth.service";

export function authRoutes(getEnv: () => Cloudflare.Env) {
  return new Elysia({ prefix: "/api/admin/auth" })
    .use(adminSecurity(getEnv))
    .post(
      "/login",
      async ({ body, cookie, request, set, status }) => {
        const ip =
          request.headers.get("CF-Connecting-IP") ?? "local-or-unavailable";
        const result = await login(getEnv().CONTENT, body, ip);
        if (!result.ok) {
          const error = {
            error: { code: result.code, message: result.message },
          };
          if (result.code === "RATE_LIMITED") {
            set.headers["Retry-After"] = String(LOGIN_WINDOW_SECONDS);
            return status(429, error);
          }
          return status(401, error);
        }

        cookie[SESSION_COOKIE].set({
          ...sessionCookieOptions,
          value: result.value.token,
          maxAge: SESSION_SECONDS,
        });
        return result.value.identity;
      },
      {
        body: loginBody,
        response: {
          200: identityResponse,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          429: errorResponse,
          500: errorResponse,
        },
      },
    )
    .get("/me", ({ identity }) => identity, {
      requireSession: true,
      response: {
        200: identityResponse,
        401: errorResponse,
        500: errorResponse,
      },
    })
    .post(
      "/logout",
      async ({ cookie }) => {
        const session = cookie[SESSION_COOKIE];
        await revokeSession(getEnv().CONTENT, session.value);
        session.set({ ...sessionCookieOptions, value: "", maxAge: 0 });
        return { ok: true as const };
      },
      {
        requireSession: true,
        response: {
          200: t.Object({ ok: t.Literal(true) }),
          401: errorResponse,
          403: errorResponse,
          500: errorResponse,
        },
      },
    );
}
