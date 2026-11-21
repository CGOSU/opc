export const USERNAME_MIN = 4;
export const USERNAME_MAX = 32;
export const USERNAME_PATTERN = "^[A-Za-z0-9_]+$";
export const PASSWORD_MIN = 5;
export const PASSWORD_MAX = 128;

const usernamePattern = new RegExp(USERNAME_PATTERN);

export function validateCredentials(username: string, password: string) {
  if (
    username.length < USERNAME_MIN ||
    username.length > USERNAME_MAX ||
    !usernamePattern.test(username)
  ) {
    return {
      ok: false,
      code: "INVALID_USERNAME",
      message: "Username must contain 4–32 letters, digits, or underscores.",
    } as const;
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return {
      ok: false,
      code: "INVALID_PASSWORD",
      message: `Password must contain ${PASSWORD_MIN}–${PASSWORD_MAX} characters.`,
    } as const;
  }
  return { ok: true, value: { username, password } } as const;
}
