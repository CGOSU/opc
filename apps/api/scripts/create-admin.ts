import passwordPrompt from "@inquirer/password";
import { connectDb } from "@opc/db";
import { createAdmin } from "@opc/db/auth";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { getPlatformProxy } from "wrangler";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateCredentials,
} from "../src/modules/auth/credentials.ts";
import { hashPassword } from "../src/modules/auth/password.ts";

async function readPassword(fromStdin: boolean) {
  if (fromStdin) {
    // Raw UTF-8 input: preserve whitespace and do not strip newlines.
    let value = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
      value += chunk;
      if (value.length > PASSWORD_MAX) throw new Error("Password too long.");
    }
    return value;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("A terminal or --password-stdin is required.");
  }
  return passwordPrompt({
    message: `Password (${PASSWORD_MIN}–${PASSWORD_MAX} characters)`,
    mask: "*",
  });
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      "password-stdin": { type: "boolean" },
      "persist-to": { type: "string" },
    },
  });
  const [username] = positionals;
  if (positionals.length !== 1 || !username) {
    console.error(
      "Usage: bun run admin:create:local <username> [--password-stdin] [--persist-to PATH]",
    );
    process.exitCode = 1;
    return;
  }

  const credentials = validateCredentials(
    username,
    await readPassword(values["password-stdin"] ?? false),
  );
  if (!credentials.ok) {
    console.error(credentials.message);
    process.exitCode = 1;
    return;
  }

  const configPath = fileURLToPath(
    new URL("../wrangler.jsonc", import.meta.url),
  );
  const statePath = fileURLToPath(
    new URL("../../web/.wrangler/state", import.meta.url),
  );
  const platform = await getPlatformProxy<Cloudflare.Env>({
    configPath,
    envFiles: [],
    remoteBindings: false,
    persist: { path: resolve(values["persist-to"] ?? statePath, "v3") },
  });
  try {
    const result = await createAdmin(
      connectDb(platform.env.CONTENT),
      credentials.value.username,
      await hashPassword(credentials.value.password),
    );
    if (!result) {
      console.error("An administrator already exists. No account was changed.");
      process.exitCode = 1;
      return;
    }
    console.log("Local administrator created.");
  } finally {
    await platform.dispose();
  }
}

try {
  await main();
} catch {
  console.error(
    "Administrator creation failed. Check the prompt, local D1 migrations, and state path.",
  );
  process.exitCode = 1;
}
