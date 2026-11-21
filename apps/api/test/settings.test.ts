import { randomBytes } from "node:crypto";
import { treaty } from "@elysiajs/eden";
import { expect, test } from "vitest";
import type { App } from "../src/app";
import {
  getSessionCookie,
  initializeAdmin,
  withWorker,
  writeHeaders,
} from "./worker-harness";

const empty = { siteName: "", defaultDescription: "" };

test("only the authenticated administrator can persist bilingual site metadata", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const api = treaty<App>(origin).api.admin;
    const credentials = {
      username: "SettingsCheck",
      password: randomBytes(24).toString("hex"),
    };
    expect(
      initializeAdmin(state, credentials.username, credentials.password).status,
    ).toBe(0);
    const login = await api.auth.login.post(credentials, {
      headers: writeHeaders,
    });
    const read = { headers: { Cookie: getSessionCookie(login.response) } };
    const write = { headers: { ...writeHeaders, ...read.headers } };
    const updated = {
      zh: { siteName: "技术手记", defaultDescription: "中文站点描述" },
      en: {
        siteName: "Field notes",
        defaultDescription: "English site description",
      },
    };

    expect((await api.settings.get()).status).toBe(401);
    expect(
      (await api.settings.put(updated, { headers: writeHeaders })).status,
    ).toBe(401);
    expect(
      (
        await api.settings.put(updated, {
          headers: { ...read.headers, Origin: writeHeaders.Origin },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await api.settings.put(updated, {
          headers: { ...write.headers, Origin: "https://other.example" },
        })
      ).status,
    ).toBe(403);
    expect((await api.settings.get(read)).data).toEqual({
      zh: empty,
      en: empty,
    });

    expect(
      (
        await api.settings.put(
          { ...updated, en: { ...updated.en, siteName: " Field notes " } },
          write,
        )
      ).data,
    ).toEqual(updated);
    expect((await api.settings.get(read)).data).toEqual(updated);
    const invalid = await api.settings.put(
      { zh: empty, en: { ...updated.en, defaultDescription: "a".repeat(321) } },
      write,
    );
    expect(invalid.status).toBe(400);
    expect((await api.settings.get(read)).data).toEqual(updated);
    expect(
      (await api.settings.put({ zh: empty, en: updated.en }, write)).status,
    ).toBe(200);
    expect((await api.settings.get(read)).data).toEqual({
      zh: empty,
      en: updated.en,
    });
  });
}, 30_000);
