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

test("jobs and creator sources enforce auth, URL deduplication, bilingual revisions, verification, and opt-out blocking", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const api = treaty<App>(origin).api.admin;
    const jobs = api.jobs;
    const sources = api["job-sources"];

    const credentials = {
      username: "JobsAdmin",
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

    // Auth & CSRF guards
    expect((await jobs.get()).status).toBe(401);
    expect((await sources.get()).status).toBe(401);
    expect(
      (
        await jobs["parse-url"].post(
          { url: "https://x.com/marc_louvion/status/1860248912041" },
          { headers: { ...read.headers, Origin: writeHeaders.Origin } },
        )
      ).status,
    ).toBe(403);

    // Invalid X URL rejected
    const badUrl = await jobs["parse-url"].post(
      { url: "https://example.com/jobs/123" },
      write,
    );
    expect(badUrl.status).toBe(400);

    // Normalize twitter.com URL with query params
    const parsed = await jobs["parse-url"].post(
      {
        url: "https://twitter.com/Marc_Louvion/status/1860248912041?s=20&t=abc",
      },
      write,
    );
    expect(parsed.status).toBe(200);
    expect(parsed.data).toMatchObject({
      handle: "marc_louvion",
      statusId: "1860248912041",
      canonicalUrl: "https://x.com/marc_louvion/status/1860248912041",
      duplicateJob: null,
      source: null,
      blockedByOptOut: false,
    });

    // Reject excerpt > 200 chars
    const tooLongExcerpt = await jobs.post(
      {
        locale: "zh",
        sourcePostUrl: "https://x.com/marc_louvion/status/1860248912041",
        title: "全栈产品工程师",
        slug: "ai-video-engineer",
        content: "### 岗位要点\n- TypeScript + Workers",
        sourceExcerpt: "a".repeat(201),
      },
      write,
    );
    expect(tooLongExcerpt.status).toBe(400);

    // Create job (auto-creates blogger source)
    const created = await jobs.post(
      {
        locale: "zh",
        sourcePostUrl:
          "https://twitter.com/Marc_Louvion/status/1860248912041?s=20",
        sourceDisplayName: "Marc Lou",
        title: "全栈产品工程师（AI 视频生成）",
        slug: "ai-video-engineer",
        summary: "负责 AI 视频工具前端与 Cloudflare Workers 推理流程。",
        content: "### 岗位要点\n- TypeScript / React / Cloudflare Workers",
        sourceExcerpt: "Hiring a full-stack product engineer who ships fast.",
        disclosureType: "curated_public",
        workMode: "remote",
        employmentType: "full_time",
        locationText: "全球 / UTC+8",
        compensationText: "$120k–$150k / 年",
        status: "open",
      },
      write,
    );
    expect(created.status).toBe(201);
    const jobId = created.data!.id;
    const sourceId = created.data!.sourceId;

    // Duplicate URL detected both by parse-url and POST /jobs
    const parsedAgain = await jobs["parse-url"].post(
      { url: "https://x.com/marc_louvion/status/1860248912041" },
      write,
    );
    expect(parsedAgain.status).toBe(200);
    expect(parsedAgain.data?.duplicateJob).toEqual({
      id: jobId,
      title: "全栈产品工程师（AI 视频生成）",
      status: "open",
    });
    expect(parsedAgain.data?.source?.id).toBe(sourceId);

    const dupCreate = await jobs.post(
      {
        locale: "zh",
        sourcePostUrl: "https://x.com/marc_louvion/status/1860248912041",
        title: "重复条目",
        slug: "another-slug",
        content: "duplicate",
      },
      write,
    );
    expect(dupCreate.status).toBe(409);

    // Add English translation independently
    const addedEn = await jobs({ id: jobId })
      .translations({ locale: "en" })
      .post(
        {
          title: "Full-Stack Product Engineer (AI Video)",
          slug: "ai-video-engineer",
          summary: "Build AI visual workflows with Cloudflare Workers.",
          content: "### Highlights\n- Remote async team",
          sourceExcerpt: "Hiring a full-stack product engineer.",
        },
        write,
      );
    expect(addedEn.status).toBe(201);
    expect(addedEn.data).toEqual({ id: jobId, locale: "en", revision: 1 });

    // Update zh translation with optimistic lock & verify stale revision conflict
    const updatedZh = await jobs({ id: jobId })
      .translations({ locale: "zh" })
      .put(
        {
          title: "全栈产品工程师（AI 视频与独立工具）",
          slug: "ai-video-engineer",
          summary: "负责 AI 视频工具与订阅系统。",
          content: "### 岗位要点\n- TypeScript / Workers / D1",
          sourceExcerpt: "Hiring a full-stack product engineer.",
          revision: 1,
        },
        write,
      );
    expect(updatedZh.status).toBe(200);
    expect(updatedZh.data?.revision).toBe(2);

    const staleZh = await jobs({ id: jobId })
      .translations({ locale: "zh" })
      .put(
        {
          title: "过期的并发覆盖",
          slug: "ai-video-engineer",
          content: "stale",
          revision: 1,
        },
        write,
      );
    expect(staleZh.status).toBe(409);

    // Update shared settings to expired, then verify (+14 days) restores to open
    const expiredPatch = await jobs({ id: jobId }).settings.patch(
      { status: "expired", disclosureType: "author_submitted" },
      write,
    );
    expect(expiredPatch.status).toBe(200);

    const verified = await jobs({ id: jobId }).verify.post(
      { extendDays: 14 },
      write,
    );
    expect(verified.status).toBe(200);
    expect(verified.data?.status).toBe("open");

    // List reflects bilingual open count
    const listed = await jobs.get({ query: { view: "all_active" }, ...read });
    expect(listed.status).toBe(200);
    expect(listed.data?.summary).toMatchObject({
      open: 1,
      bilingualOpen: 1,
      sources: 1,
      optOutSources: 0,
    });

    // Enable opt_out on creator source + cascade takedown existing jobs to removed (410)
    const optedOut = await sources({ id: sourceId }).patch(
      {
        optOut: true,
        optOutNote: "2026-11-24 博主邮件要求撤下并拒绝后续收录",
        takedownExistingJobs: true,
      },
      write,
    );
    expect(optedOut.status).toBe(200);
    expect(optedOut.data?.optOut).toBe(true);
    expect(optedOut.data?.removedCount).toBe(1);

    const detailAfterOptOut = await jobs({ id: jobId }).get(read);
    expect(detailAfterOptOut.data?.status).toBe("removed");

    // parse-url flags blockedByOptOut and new job creation is rejected (409)
    const blockedParse = await jobs["parse-url"].post(
      { url: "https://x.com/marc_louvion/status/1869999999999" },
      write,
    );
    expect(blockedParse.status).toBe(200);
    expect(blockedParse.data?.blockedByOptOut).toBe(true);

    const blockedCreate = await jobs.post(
      {
        locale: "zh",
        sourcePostUrl: "https://x.com/marc_louvion/status/1869999999999",
        title: "被拦截的新岗位",
        slug: "blocked-role",
        content: "should be rejected",
      },
      write,
    );
    expect(blockedCreate.status).toBe(409);

    // Reopening a removed job from an opt-out source is also blocked
    const blockedReopen = await jobs({ id: jobId }).settings.patch(
      { status: "open" },
      write,
    );
    expect(blockedReopen.status).toBe(409);

    // Cannot delete source while jobs exist; succeeds after deleting job
    expect((await sources({ id: sourceId }).delete(undefined, write)).status).toBe(
      409,
    );
    expect((await jobs({ id: jobId }).delete(undefined, write)).status).toBe(200);
    expect((await sources({ id: sourceId }).delete(undefined, write)).status).toBe(
      200,
    );
  });
}, 30_000);
