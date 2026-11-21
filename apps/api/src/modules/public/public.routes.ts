import { connectDb } from "@opc/db";
import { getPublicPost, listPosts } from "@opc/db/posts";
import { getPublicTerm, listPublicTerms } from "@opc/db/taxonomy";
import { Elysia, t } from "elysia";
import { authError, errorResponse } from "../auth/auth.schema";
import {
  publicDetail,
  publicList,
  publicQuery,
  slugSchema,
} from "../posts/posts.schema";

type Post = Awaited<ReturnType<typeof listPosts>>["items"][number];
function project({
  title,
  slug,
  locale,
  summary,
  path,
  coverImage,
  publishedAt,
  updatedAt,
  category,
  tags,
}: Post) {
  return {
    title,
    slug,
    locale,
    summary,
    path,
    coverImage,
    publishedAt,
    updatedAt,
    category,
    tags: tags.map(({ name }) => name),
  };
}
const params = t.Object({ slug: slugSchema });
const errors = { 400: errorResponse, 404: errorResponse, 500: errorResponse };
const termList = t.Object({
  items: t.Array(
    t.Object({ name: t.String(), slug: t.String(), description: t.String() }),
  ),
  page: t.Integer(),
  pageSize: t.Integer(),
  total: t.Integer(),
});

function termRoutes<const Kind extends "categories" | "tags">(
  getEnv: () => Cloudflare.Env,
  kind: Kind,
) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia({ prefix: `/api/public/${kind}` })
    .get(
      "/",
      async ({ query }) => {
        return listPublicTerms(db(), kind, query);
      },
      { query: publicQuery, response: { 200: termList, ...errors } },
    )
    .get(
      "/:slug/posts",
      async ({ params, query, status }) => {
        if (!(await getPublicTerm(db(), kind, params.slug, query.locale)))
          return status(
            404,
            authError("TERM_NOT_FOUND", "Classification not found."),
          );
        const result = await listPosts(db(), {
          ...query,
          term: { kind, slug: params.slug },
        });
        return { ...result, items: result.items.map(project) };
      },
      { params, query: publicQuery, response: { 200: publicList, ...errors } },
    );
}

export function publicRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia()
    .get(
      "/api/public/posts",
      async ({ query }) => {
        const result = await listPosts(db(), query);
        return { ...result, items: result.items.map(project) };
      },
      { query: publicQuery, response: { 200: publicList, ...errors } },
    )
    .get(
      "/api/public/posts/:slug",
      async ({ params, query, status }) => {
        const post = await getPublicPost(
          db(),
          query.locale ?? "zh",
          params.slug,
        );
        if (!post)
          return status(
            404,
            authError("POST_NOT_FOUND", "Article version not found."),
          );
        return { ...project(post), content: post.content };
      },
      {
        params,
        query: publicQuery,
        response: { 200: publicDetail, ...errors },
      },
    )
    .use(termRoutes(getEnv, "categories"))
    .use(termRoutes(getEnv, "tags"));
}
