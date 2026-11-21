import { queryOptions } from "@tanstack/react-query";
import { adminApi, writeOptions } from "../lib/admin-api";
import { readResult } from "../taxonomy/api";

const { topics } = adminApi;
export const topicsKey = ["topics"] as const;
export type TopicInput = Parameters<typeof topics.post>[0];
export type TopicDetail = NonNullable<
  Awaited<ReturnType<ReturnType<typeof topics>["get"]>>["data"]
>;
export type TopicRow = NonNullable<
  Awaited<ReturnType<typeof topics.get>>["data"]
>["items"][number];
export type TopicArticle = TopicDetail["articles"][number];
type Query = NonNullable<
  NonNullable<Parameters<typeof topics.get>[0]>["query"]
>;

export function topicList(query: Query) {
  return queryOptions({
    queryKey: [...topicsKey, "list", query],
    queryFn: ({ signal }) =>
      readResult(topics.get({ query, fetch: { signal } })),
  });
}

export function topicOptions() {
  return queryOptions({
    queryKey: [...topicsKey, "options"],
    queryFn: async ({ signal }) => {
      const items: TopicRow[] = [];
      for (let page = 1; ; page++) {
        const result = await readResult(
          topics.get({ query: { page, pageSize: 50 }, fetch: { signal } }),
        );
        items.push(...result.items);
        if (!result.items.length || items.length >= result.total) return items;
      }
    },
    staleTime: 30_000,
  });
}

export function topicDetail(id: string | undefined) {
  return queryOptions({
    queryKey: [...topicsKey, "detail", id],
    enabled: !!id,
    queryFn: ({ signal }) => {
      if (!id) throw new Error("缺少专题 ID。");
      return readResult(topics({ id }).get({ fetch: { signal } }));
    },
  });
}

export function createTopic(data: TopicInput) {
  return readResult(topics.post(data, writeOptions));
}

type TranslationInput = Omit<TopicInput, "locale" | "coverImage" | "sortOrder">;
export function saveTopicTranslation(
  id: string,
  locale: TopicInput["locale"],
  data: TranslationInput,
  exists: boolean,
) {
  const translation = topics({ id }).translations({ locale });
  return readResult(
    exists
      ? translation.put(data, writeOptions)
      : translation.post(data, writeOptions),
  );
}

export function saveTopicSettings(
  id: string,
  data: Pick<TopicInput, "coverImage" | "sortOrder">,
) {
  return readResult(topics({ id }).settings.patch(data, writeOptions));
}

export function saveTopicOrder(id: string, articles: TopicArticle[]) {
  return readResult(
    topics({ id }).posts.put(
      articles.map(({ id }) => id),
      writeOptions,
    ),
  );
}

export function deleteTopic(id: string) {
  return readResult(topics({ id }).delete(undefined, writeOptions));
}
