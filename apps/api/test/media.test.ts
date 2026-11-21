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

const samplePng = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
);

test("cover image upload enforces auth, validates magic bytes, serves from R2 and saves on posts and topics", async () => {
  await withWorker("src/index.ts", true, async (origin, state) => {
    const creds = {
      username: "MediaCheck",
      password: randomBytes(24).toString("hex"),
    };
    const provisioned = initializeAdmin(
      state,
      creds.username,
      creds.password,
    );
    expect(provisioned.status, provisioned.stderr).toBe(0);

    const { admin, public: published } = treaty<App>(origin).api;
    const uploadEndpoint = `${origin}/api/admin/media/covers`;

    const buildForm = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => {
      const form = new FormData();
      form.set("file", new File([bytes], name, { type }));
      return form;
    };

    const unauth = await fetch(uploadEndpoint, {
      method: "POST",
      headers: writeHeaders,
      body: buildForm(samplePng, "cover.png", "image/png"),
    });
    expect(unauth.status).toBe(401);

    const login = await admin.auth.login.post(creds, { headers: writeHeaders });
    const Cookie = getSessionCookie(login.response);

    const missingCsrf = await fetch(uploadEndpoint, {
      method: "POST",
      headers: { Origin: writeHeaders.Origin, Cookie },
      body: buildForm(samplePng, "cover.png", "image/png"),
    });
    expect(missingCsrf.status).toBe(403);

    const fakeSvg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const spoofed = await fetch(uploadEndpoint, {
      method: "POST",
      headers: { ...writeHeaders, Cookie },
      body: buildForm(fakeSvg, "fake.png", "image/png"),
    });
    expect(spoofed.status).toBe(400);
    expect(await spoofed.json()).toMatchObject({
      error: { code: "INVALID_IMAGE" },
    });

    const upload = await fetch(uploadEndpoint, {
      method: "POST",
      headers: { ...writeHeaders, Cookie },
      body: buildForm(samplePng, "cover.png", "image/png"),
    });
    expect(upload.status).toBe(201);
    const uploaded = (await upload.json()) as {
      url: string;
      key: string;
      contentType: string;
      size: number;
    };
    expect(uploaded.contentType).toBe("image/png");
    expect(uploaded.size).toBe(samplePng.byteLength);
    expect(uploaded.key).toMatch(/^covers\/[0-9a-f-]+\.png$/);
    expect(uploaded.url).toBe(`${origin}/api/public/media/${uploaded.key}`);

    const fetched = await fetch(uploaded.url);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("Content-Type")).toBe("image/png");
    expect(fetched.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(fetched.headers.get("Cross-Origin-Resource-Policy")).toBe(
      "cross-origin",
    );
    expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(samplePng);

    const write = { headers: { ...writeHeaders, Cookie } };
    const read = { headers: { Cookie } };

    const createdPost = await admin.posts.post(
      {
        locale: "zh",
        title: "带上传封面的文章",
        slug: "uploaded-post-cover",
        summary: "测试上传封面",
        content: "# 正文\n\n包含已上传的封面地址。",
        coverImage: uploaded.url,
      },
      write,
    );
    expect(createdPost.status).toBe(201);
    const postId = createdPost.data?.id;
    expect(postId).toBeTruthy();

    const postDetail = await admin.posts({ id: postId! }).get(read);
    expect(postDetail.data?.sharedCoverImage).toBe(uploaded.url);
    expect(postDetail.data?.coverImage).toBe(uploaded.url);

    const publicPost = await published.posts({ slug: "uploaded-post-cover" }).get({
      query: { locale: "zh" },
    });
    expect(publicPost.data?.coverImage).toBe(uploaded.url);

    const createdTopic = await admin.topics.post(
      {
        locale: "zh",
        title: "带上传封面的专题",
        slug: "uploaded-topic-cover",
        description: "专题封面上传测试",
        coverImage: uploaded.url,
      },
      write,
    );
    expect(createdTopic.status).toBe(201);
    const topicId = createdTopic.data?.id;
    expect(topicId).toBeTruthy();

    const topicDetail = await admin.topics({ id: topicId! }).get(read);
    expect(topicDetail.data?.coverImage).toBe(uploaded.url);
  });
});
