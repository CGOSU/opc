import { Elysia, status } from "elysia";
import { connectDb } from "@opc/db";
import {
  createTerm,
  createTermTranslation,
  deleteTerm,
  getTerm,
  listTerms,
  updateTermSettings,
  updateTermTranslation,
} from "@opc/db/taxonomy";
import { adminSecurity } from "../../plugins/admin-security";
import { authError } from "../auth/auth.schema";
import {
  settingsBody,
  termBody,
  termErrors,
  termListQuery,
  termListResponse,
  termParams,
  termResponse,
  translationBody,
  translationParams,
  translationUpdate,
} from "./taxonomy.schema";

const conflicts = {
  DUPLICATE_TERM: "This language version, name or slug is already in use.",
  TERM_REVISION_CONFLICT:
    "The language version has changed; reload it before saving.",
  CATEGORY_IN_USE: "Move all articles out of this category before deleting it.",
};
type WriteResult =
  | { ok: true; value: { id: string } }
  | { ok: false; code: keyof typeof conflicts | "TERM_NOT_FOUND" };

function notFound() {
  return status(404, authError("TERM_NOT_FOUND", "Classification not found."));
}
function respond(result: WriteResult, success: 200 | 201) {
  if (result.ok)
    return success === 201
      ? status(201, result.value)
      : status(200, result.value);
  if (result.code === "TERM_NOT_FOUND") return notFound();
  return status(409, authError(result.code, conflicts[result.code]));
}

export const categoryRoutes = (getEnv: () => Cloudflare.Env) =>
  taxonomyRoutes(getEnv, "categories");
export const tagRoutes = (getEnv: () => Cloudflare.Env) =>
  taxonomyRoutes(getEnv, "tags");

function taxonomyRoutes<const K extends "categories" | "tags">(
  getEnv: () => Cloudflare.Env,
  kind: K,
) {
  const db = () => connectDb(getEnv().CONTENT);
  const writeResponses = { 200: termParams, 201: termParams, ...termErrors };
  return new Elysia({ prefix: `/api/admin/${kind}` as const })
    .use(adminSecurity(getEnv))
    .get(
      "/",
      ({ query }) =>
        listTerms(db(), kind, { ...query, search: query.search?.trim() }),
      {
        requireSession: true,
        query: termListQuery,
        response: { 200: termListResponse, ...termErrors },
      },
    )
    .get(
      "/:id",
      async ({ params }) => {
        const term = await getTerm(db(), kind, params.id);
        return term ? status(200, term) : notFound();
      },
      {
        requireSession: true,
        params: termParams,
        response: { 200: termResponse, ...termErrors },
      },
    )
    .post(
      "/",
      async ({ body }) => respond(await createTerm(db(), kind, body), 201),
      {
        requireSession: true,
        body: termBody,
        response: writeResponses,
      },
    )
    .post(
      "/:id/translations/:locale",
      async ({ params, body }) =>
        respond(
          await createTermTranslation(
            db(),
            kind,
            params.id,
            params.locale,
            body,
          ),
          201,
        ),
      {
        requireSession: true,
        params: translationParams,
        body: translationBody,
        response: writeResponses,
      },
    )
    .put(
      "/:id/translations/:locale",
      async ({ params, body }) =>
        respond(
          await updateTermTranslation(
            db(),
            kind,
            params.id,
            params.locale,
            body,
          ),
          200,
        ),
      {
        requireSession: true,
        params: translationParams,
        body: translationUpdate,
        response: writeResponses,
      },
    )
    .patch(
      "/:id/settings",
      async ({ params, body }) =>
        respond(
          await updateTermSettings(db(), kind, params.id, body.sortOrder),
          200,
        ),
      {
        requireSession: true,
        params: termParams,
        body: settingsBody,
        response: writeResponses,
      },
    )
    .delete(
      "/:id",
      async ({ params }) =>
        respond(await deleteTerm(db(), kind, params.id), 200),
      {
        requireSession: true,
        params: termParams,
        response: writeResponses,
      },
    );
}
