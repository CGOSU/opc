import { t } from "elysia";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from "./credentials";

export const loginBody = t.Object(
  {
    username: t.String({
      minLength: USERNAME_MIN,
      maxLength: USERNAME_MAX,
      pattern: USERNAME_PATTERN,
    }),
    password: t.String({ minLength: PASSWORD_MIN, maxLength: PASSWORD_MAX }),
  },
  { additionalProperties: false },
);

export const identityResponse = t.Object({
  id: t.String(),
  username: t.String(),
});

export const errorResponse = t.Object({
  error: t.Object({ code: t.String(), message: t.String() }),
});

export function authError(code: string, message: string) {
  return { error: { code, message } };
}
