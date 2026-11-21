import { queryOptions } from "@tanstack/react-query";
import { adminApi, writeOptions } from "../lib/admin-api";
import {
  readResult,
  taxonomyKey,
  type TaxonomyKind,
  type Term,
} from "../taxonomy/api";

const { posts } = adminApi;
export type PostListQuery = NonNullable<
  NonNullable<Parameters<typeof posts.get>[0]>["query"]
>;
export type PostInput = Parameters<typeof posts.post>[0];
export type PostDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof posts>["get"]>>["data"]
>;
export type PostRow = NonNullable<
  Awaited<ReturnType<typeof posts.get>>["data"]
>["items"][number];
export const postsKey = ["posts"] as const;

export function postList(query: PostListQuery) {
  return queryOptions({
    queryKey: [...postsKey, "list", query],
    queryFn: ({ signal }) =>
      readResult(posts.get({ query, fetch: { signal } })),
  });
}

export function postDetail(id: string | undefined) {
  return queryOptions({
    queryKey: [...postsKey, "detail", id],
    enabled: !!id,
    queryFn: ({ signal }) => {
      if (!id) throw new Error("缺少文章 ID。");
      return readResult(posts({ id }).get({ fetch: { signal } }));
    },
  });
}

export function termOptions(kind: TaxonomyKind) {
  return queryOptions({
    queryKey: [...taxonomyKey(kind), "options"],
    queryFn: async ({ signal }) => {
      const items: Term[] = [];
      for (let page = 1; ; page++) {
        const result = await readResult(
          adminApi[kind].get({
            query: { page, pageSize: 50 },
            fetch: { signal },
          }),
        );
        items.push(...result.items);
        if (page * result.pageSize >= result.total || !result.items.length)
          return items;
      }
    },
    staleTime: 30_000,
  });
}

type LocalizedPost = ReturnType<ReturnType<typeof posts>["translations"]>;
export type TranslationInput = Parameters<LocalizedPost["post"]>[0];
export type PostSettings = Pick<
  PostInput,
  "categoryId" | "tagIds" | "topicIds" | "coverImage"
>;

export function createPost(values: PostInput) {
  return readResult(posts.post(values, writeOptions));
}

export function createTranslation(
  postId: string,
  locale: PostInput["locale"],
  values: TranslationInput,
) {
  return readResult(
    posts({ id: postId }).translations({ locale }).post(values, writeOptions),
  );
}

export function saveTranslation(
  postId: string,
  locale: PostInput["locale"],
  revision: number,
  values: TranslationInput,
) {
  return readResult(
    posts({ id: postId })
      .translations({ locale })
      .put({ ...values, revision }, writeOptions),
  );
}

export function reloadTranslation(postId: string, locale: PostInput["locale"]) {
  return readResult(posts({ id: postId }).translations({ locale }).get());
}

export function savePostSettings(postId: string, values: PostSettings) {
  return readResult(posts({ id: postId }).settings.patch(values, writeOptions));
}

export function deletePost(id: string) {
  return readResult(posts({ id }).delete(undefined, writeOptions));
}
