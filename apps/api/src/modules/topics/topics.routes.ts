import { connectDb } from "@opc/db";
import {
  deleteTopic,
  getPublicTopic,
  getTopic,
  listPublicTopics,
  listTopics,
  replaceTopicPosts,
  createTopic,
  saveTopicTranslation,
  updateTopicSettings,
} from "@opc/db/topics";
import { Elysia, status, t } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { authError, errorResponse } from "../auth/auth.schema";
import { localeSchema, postParams, slugSchema } from "../posts/posts.schema";
import {
  adminTopicQuery,
  publicTopicDetail,
  publicTopicList,
  topicArticleIds,
  topicBody,
  topicDetail,
  topicList,
  topicLocaleParams,
  topicSettings,
  topicTranslation,
  topicQuery,
} from "./topics.schema";

const errors = {
  TOPIC_NOT_FOUND: [404, "Topic not found."],
  TOPIC_TRANSLATION_NOT_FOUND: [404, "Topic translation not found."],
  TOPIC_TRANSLATION_EXISTS: [409, "This language already exists."],
  DUPLICATE_TOPIC_SLUG: [409, "The topic slug is already in use."],
  INVALID_TOPIC_ARTICLE: [
    400,
    "An article no longer exists or is not published.",
  ],
  DUPLICATE_TOPIC_ARTICLE: [400, "An article may appear only once per topic."],
} as const;

function failure(code: keyof typeof errors) {
  const [httpStatus, message] = errors[code];
  return status(httpStatus, authError(code, message));
}
const notFound = () =>
  status(404, authError("TOPIC_NOT_FOUND", errors.TOPIC_NOT_FOUND[1]));
const publicErrors = {
  400: errorResponse,
  404: errorResponse,
  500: errorResponse,
};
const adminErrors = {
  ...publicErrors,
  401: errorResponse,
  403: errorResponse,
  409: errorResponse,
};

export function topicRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia({ prefix: "/api/admin/topics" })
    .use(adminSecurity(getEnv))
    .get("/", ({ query }) => listTopics(db(), query), {
      requireSession: true,
      query: adminTopicQuery,
      response: { 200: topicList, ...adminErrors },
    })
    .get(
      "/:id",
      async ({ params }) => (await getTopic(db(), params.id)) ?? notFound(),
      {
        requireSession: true,
        params: postParams,
        response: { 200: topicDetail, ...adminErrors },
      },
    )
    .post(
      "/",
      async ({ body }) => {
        const result = await createTopic(db(), {
          ...body,
          title: body.title.trim(),
        });
        return result.ok ? status(201, result.value) : failure(result.code);
      },
      {
        requireSession: true,
        body: topicBody,
        response: { 201: postParams, ...adminErrors },
      },
    )
    .post(
      "/:id/translations/:locale",
      async ({ params, body }) => {
        const result = await saveTopicTranslation(
          db(),
          params.id,
          params.locale,
          { ...body, title: body.title.trim() },
          true,
        );
        return result.ok ? status(201, result.value) : failure(result.code);
      },
      {
        requireSession: true,
        params: topicLocaleParams,
        body: topicTranslation,
        response: { 201: postParams, ...adminErrors },
      },
    )
    .put(
      "/:id/translations/:locale",
      async ({ params, body }) => {
        const result = await saveTopicTranslation(
          db(),
          params.id,
          params.locale,
          { ...body, title: body.title.trim() },
          false,
        );
        return result.ok ? result.value : failure(result.code);
      },
      {
        requireSession: true,
        params: topicLocaleParams,
        body: topicTranslation,
        response: { 200: postParams, ...adminErrors },
      },
    )
    .patch(
      "/:id/settings",
      async ({ params, body }) =>
        (await updateTopicSettings(db(), params.id, body)) ?? notFound(),
      {
        requireSession: true,
        params: postParams,
        body: topicSettings,
        response: { 200: postParams, ...adminErrors },
      },
    )
    .delete(
      "/:id",
      async ({ params }) => (await deleteTopic(db(), params.id)) ?? notFound(),
      {
        requireSession: true,
        params: postParams,
        response: { 200: postParams, ...adminErrors },
      },
    )
    .put(
      "/:id/posts",
      async ({ params, body }) => {
        const result = await replaceTopicPosts(db(), params.id, body);
        return result.ok ? result.value : failure(result.code);
      },
      {
        requireSession: true,
        params: postParams,
        body: topicArticleIds,
        response: { 200: postParams, ...adminErrors },
      },
    );
}

export function publicTopicRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia({ prefix: "/api/public/topics" })
    .get(
      "/",
      ({ query }) => listPublicTopics(db(), query.locale ?? "zh", query),
      {
        query: t.Object(
          { ...topicQuery.properties, locale: t.Optional(localeSchema) },
          { additionalProperties: false },
        ),
        response: { 200: publicTopicList, ...publicErrors },
      },
    )
    .get(
      "/:slug",
      async ({ params, query }) =>
        (await getPublicTopic(db(), query.locale ?? "zh", params.slug)) ??
        notFound(),
      {
        params: t.Object({ slug: slugSchema }),
        query: t.Object(
          { locale: t.Optional(localeSchema) },
          { additionalProperties: false },
        ),
        response: { 200: publicTopicDetail, ...publicErrors },
      },
    );
}
