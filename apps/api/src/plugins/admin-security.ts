import { Elysia } from "elysia";
import { authError } from "../modules/auth/auth.schema";
import { readIdentity } from "../modules/auth/auth.service";

export const SESSION_COOKIE = "__Host-opc-session";
export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
} as const;

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function adminSecurity(getEnv: () => Cloudflare.Env) {
  return new Elysia({ name: "opc-admin-security" })
    .onBeforeHandle({ as: "scoped" }, ({ request, status }) => {
      if (safeMethods.has(request.method)) return;

      const origin = getEnv().ADMIN_ORIGIN;
      if (
        !origin ||
        request.headers.get("Origin") !== origin ||
        request.headers.get("X-OPC-CSRF") !== "1"
      ) {
        return status(
          403,
          authError(
            "FORBIDDEN_ORIGIN",
            "Request origin could not be verified.",
          ),
        );
      }
    })
    .macro({
      requireSession: {
        async resolve({ cookie, status }) {
          const identity = await readIdentity(
            getEnv().CONTENT,
            cookie[SESSION_COOKIE].value,
          );
          if (!identity)
            return status(
              401,
              authError("SESSION_REQUIRED", "Sign in to continue."),
            );
          return { identity };
        },
      },
    });
}
