import { connectDb } from "@opc/db";
import {
  createPost,
  createPostTranslation,
  deletePost,
  getPost,
  getPostTranslation,
  listPosts,
  updatePostSettings,
  updatePostTranslation,
} from "@opc/db/posts";
import { Elysia, status, ValidationError } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { authError } from "../auth/auth.schema";
import {
  adminDetail,
  adminList,
  adminQuery,
  createBody,
  postErrors,
  postParams,
  settingsBody,
  translationBody,
  translationParams,
  translationSaved,
  updateTranslationBody,
} from "./posts.schema";

const errors = {
  POST_NOT_FOUND: [404, "Article version not found."],
  DUPLICATE_SLUG: [409, "This slug is already reserved."],
  DUPLICATE_LOCALE: [409, "This language version already exists."],
  REVISION_CONFLICT: [
    409,
    "This language version has changed or no longer exists.",
  ],
  INVALID_ARTICLE_REFERENCE: [
    400,
    "A selected category, tag, or topic no longer exists.",
  ],
  ARTICLE_REQUIRED_BY_SITE: [
    409,
    "This language version is required by the published navigation or collection.",
  ],
} as const;

function failure(code: keyof typeof errors) {
  const [httpStatus, message] = errors[code];
  return status(httpStatus, authError(code, message));
}

// Elysia normalizes objects before checking their schemas; reject out-of-scope
// write fields before that normalization can silently remove them.
function strictWriteBody(
  schema:
    | typeof createBody
    | typeof settingsBody
    | typeof translationBody
    | typeof updateTranslationBody,
) {
  return ({ body }: { body: unknown }) => {
    if (
      body &&
      typeof body === "object" &&
      Object.keys(body).some((key) => !Object.hasOwn(schema.properties, key))
    ) {
      throw new ValidationError("body", schema, body);
    }
  };
}

function normalizeTranslation(fields: typeof translationBody.static) {
  return {
    ...fields,
    title: fields.title.trim(),
    summary: fields.summary ?? "",
  };
}

export function postRoutes(getEnv: () => Cloudflare.Env) {
  const db = () => connectDb(getEnv().CONTENT);
  return new Elysia({ prefix: "/api/admin/posts" })
    .use(adminSecurity(getEnv))
    .get("/", ({ query }) => listPosts(db(), query, true), {
      requireSession: true,
      query: adminQuery,
      response: { 200: adminList, ...postErrors },
    })
    .get(
      "/:id",
      async ({ params }) => {
        return (
          (await getPost(db(), params.id)) ??
          status(404, authError("POST_NOT_FOUND", errors.POST_NOT_FOUND[1]))
        );
      },
      {
        requireSession: true,
        params: postParams,
        response: { 200: adminDetail, ...postErrors },
      },
    )
    .post(
      "/",
      async ({ body }) => {
        const { locale, coverImage, categoryId, tagIds, topicIds, ...fields } =
          body;
        const saved = await createPost(
          db(),
          locale,
          normalizeTranslation(fields),
          {
            coverImage,
            categoryId,
            tagIds,
            topicIds,
          },
        );
        return saved.ok ? status(201, saved.value) : failure(saved.code);
      },
      {
        requireSession: true,
        body: createBody,
        transform: strictWriteBody(createBody),
        response: { 201: postParams, ...postErrors },
      },
    )
    .get(
      "/:id/translations/:locale",
      async ({ params }) =>
        (await getPostTranslation(db(), params.id, params.locale)) ??
        failure("POST_NOT_FOUND"),
      {
        requireSession: true,
        params: translationParams,
        response: { 200: adminDetail, ...postErrors },
      },
    )
    .post(
      "/:id/translations/:locale",
      async ({ params, body }) => {
        const saved = await createPostTranslation(
          db(),
          params.id,
          params.locale,
          normalizeTranslation(body),
        );
        return saved.ok ? status(201, saved.value) : failure(saved.code);
      },
      {
        requireSession: true,
        body: translationBody,
        transform: strictWriteBody(translationBody),
        params: translationParams,
        response: { 201: postParams, ...postErrors },
      },
    )
    .put(
      "/:id/translations/:locale",
      async ({ params, body: { revision, ...fields } }) => {
        const saved = await updatePostTranslation(
          db(),
          params.id,
          params.locale,
          revision,
          normalizeTranslation(fields),
        );
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        body: updateTranslationBody,
        transform: strictWriteBody(updateTranslationBody),
        params: translationParams,
        response: { 200: translationSaved, ...postErrors },
      },
    )
    .patch(
      "/:id/settings",
      async ({ params, body }) => {
        const saved = await updatePostSettings(db(), params.id, body);
        return saved.ok ? saved.value : failure(saved.code);
      },
      {
        requireSession: true,
        body: settingsBody,
        transform: strictWriteBody(settingsBody),
        params: postParams,
        response: { 200: postParams, ...postErrors },
      },
    )
    .delete(
      "/:id",
      async ({ params }) => {
        const removed = await deletePost(db(), params.id);
        return removed.ok ? removed.value : failure(removed.code);
      },
      {
        requireSession: true,
        params: postParams,
        response: { 200: postParams, ...postErrors },
      },
    );
}
