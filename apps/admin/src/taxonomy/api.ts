import { queryOptions } from "@tanstack/react-query";
import { adminApi, writeOptions } from "../lib/admin-api";

const { categories } = adminApi;
export type TaxonomyKind = "categories" | "tags";
export type TermValues = Parameters<typeof categories.post>[0];
type ListOptions = NonNullable<Parameters<typeof categories.get>[0]>;
type TermList = NonNullable<Awaited<ReturnType<typeof categories.get>>["data"]>;
export type Term = TermList["items"][number];

function errorCode(failure: unknown) {
  if (typeof failure !== "object" || !failure || !("value" in failure)) return;
  const { value } = failure;
  if (typeof value !== "object" || !value || !("error" in value)) return;
  const { error } = value;
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code;
}

function displayError(status: number, failure: unknown) {
  if (status === 401) return "会话已过期，请重新登录。";
  if (status === 403) return "无法验证操作来源。请通过后台地址打开页面。";
  switch (errorCode(failure)) {
    case "DUPLICATE_TOPIC_SLUG":
      return "专题 Slug 已被占用。";
    case "TOPIC_NOT_FOUND":
      return "找不到该专题，可能已被删除。";
    case "INVALID_TOPIC_ARTICLE":
      return "有文章已被删除或尚未发布，请核对列表后再保存。";
    case "DUPLICATE_TOPIC_ARTICLE":
      return "同一篇文章不能重复加入专题。";
    case "DUPLICATE_SLUG":
      return "这个 Slug 已被占用，请更换。";
    case "DUPLICATE_LOCALE":
      return "同一篇文章的这个语言版本已存在。";
    case "REVISION_CONFLICT":
      return "当前语言版本已被修改或删除，未覆盖服务器内容。你的草稿仍保留在编辑器中。";
    case "INVALID_ARTICLE_REFERENCE":
      return "所选分类、标签或专题已不存在，请刷新选项。";
    case "ARTICLE_REQUIRED_BY_SITE":
      return "这个语言版本仍被导航或专题设为必需项，请先移除该引用。";
    case "POST_NOT_FOUND":
      return "这个文章版本已不存在。";
    case "DUPLICATE_TERM":
      return "该语言版本、名称或 Slug 已被占用，旧地址也不能转给其他条目。";
    case "TERM_REVISION_CONFLICT":
      return "该语言版本已被更新。草稿仍保留，可重新载入服务器版本。";
    case "CATEGORY_IN_USE":
      return "分类仍有关联文章，移除关联后才能删除。";
    case "TERM_NOT_FOUND":
      return "这条记录已不存在，请刷新列表。";
    case "INVALID_SOURCE_URL":
      return "请输入有效的 X / Twitter 推文链接（如 https://x.com/handle/status/123456）。";
    case "INVALID_HANDLE":
      return "博主 X 账号仅支持字母、数字与下划线（1–64 字符）。";
    case "SOURCE_NOT_FOUND":
      return "找不到对应的博主档案，可能已被删除。";
    case "DUPLICATE_HANDLE":
      return "该 X 博主账号已在博主库中。";
    case "SOURCE_HAS_JOBS":
      return "该博主仍有关联的招聘条目，无法删除。";
    case "SOURCE_OPTED_OUT":
      return "该博主已列入拒收名单（opt_out），系统已阻止录入或重新上架。";
    case "JOB_NOT_FOUND":
      return "找不到对应的招聘条目或语言版本。";
    case "DUPLICATE_SOURCE_URL":
      return "该 X 原推文链接已被收录，请勿重复录入。";
    case "INVALID_REQUEST":
      return "提交内容不符合要求，请检查字段。";
    default:
      return "暂时无法完成操作，请稍后重试。";
  }
}

export class AdminRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function readResult<T>(
  request: Promise<{ data: T | null; error: unknown; status: number }>,
) {
  const result = await request.catch(() => {
    throw new Error("无法连接服务，请检查网络后重试。");
  });
  if (result.error) {
    throw new AdminRequestError(
      displayError(result.status, result.error),
      errorCode(result.error),
    );
  }
  if (!result.data) throw new Error("服务未返回所需数据，请重试。");
  return result.data;
}

export const taxonomyKey = (kind: TaxonomyKind) => ["taxonomy", kind] as const;

export function termListQuery(kind: TaxonomyKind, query: ListOptions["query"]) {
  return queryOptions({
    queryKey: [...taxonomyKey(kind), query],
    retry: false,
    queryFn: ({ signal }) =>
      readResult(adminApi[kind].get({ query, fetch: { signal } })),
  });
}

export type Locale = TermValues["locale"];
export type TranslationValues = Omit<TermValues, "locale" | "sortOrder">;

export function saveTerm(kind: TaxonomyKind, values: TermValues) {
  return readResult(adminApi[kind].post(values, writeOptions));
}

export function loadTerm(kind: TaxonomyKind, id: string) {
  return readResult(adminApi[kind]({ id }).get());
}

export function saveTermTranslation(
  kind: TaxonomyKind,
  id: string,
  locale: Locale,
  values: TranslationValues,
  revision?: number,
) {
  const route = adminApi[kind]({ id }).translations({ locale });
  return revision === undefined
    ? readResult(route.post(values, writeOptions))
    : readResult(route.put({ ...values, revision }, writeOptions));
}

export function saveTermSettings(
  kind: TaxonomyKind,
  id: string,
  sortOrder: number,
) {
  return readResult(
    adminApi[kind]({ id }).settings.patch({ sortOrder }, writeOptions),
  );
}

export function removeTerm(kind: TaxonomyKind, id: string) {
  return readResult(adminApi[kind]({ id }).delete(undefined, writeOptions));
}
