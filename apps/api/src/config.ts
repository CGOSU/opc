type ListenOptions = { host: "127.0.0.1"; port: number };
type ConfigResult =
  | { ok: true; value: ListenOptions }
  | {
      ok: false;
      error: {
        code: "PORT_EMPTY" | "PORT_FORMAT" | "PORT_RANGE";
        message: string;
      };
    };

export function parseListenOptions(port: string | undefined): ConfigResult {
  if (port === undefined)
    return { ok: true, value: { host: "127.0.0.1", port: 3001 } };
  const value = port.trim();
  if (!value)
    return {
      ok: false,
      error: { code: "PORT_EMPTY", message: "PORT must not be empty." },
    };
  if (!/^\d+$/.test(value))
    return {
      ok: false,
      error: {
        code: "PORT_FORMAT",
        message: "PORT must be a decimal integer.",
      },
    };
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    return {
      ok: false,
      error: {
        code: "PORT_RANGE",
        message: "PORT must be between 1 and 65535.",
      },
    };
  }
  return { ok: true, value: { host: "127.0.0.1", port: number } };
}
