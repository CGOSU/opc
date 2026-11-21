import { queryOptions } from "@tanstack/react-query";
import { adminApi, writeOptions } from "../lib/admin-api";

const auth = adminApi.auth;

export type SignInValues = Parameters<typeof auth.login.post>[0];

export const sessionQuery = queryOptions({
  queryKey: ["admin-session"],
  retry: false,
  queryFn: async ({ signal }) => {
    const { data, error } = await auth.me.get({ fetch: { signal } });
    if (error?.status === 401) return null;
    if (error) throw new Error("无法检查登录状态，请重试。");
    return data;
  },
});

export async function signIn(values: SignInValues) {
  const result = await auth.login.post(values, writeOptions).catch(() => null);
  if (result && !result.error) return result.data;
  if (result?.error?.status === 401) throw new Error("用户名或密码错误。");
  if (result?.error?.status === 429)
    throw new Error("登录尝试次数过多，请稍后再试。");
  if (result?.error?.status === 400)
    throw new Error("请检查用户名和密码格式。");
  throw new Error("暂时无法登录，请稍后重试。");
}

export async function signOut() {
  const result = await auth.logout
    .post(undefined, writeOptions)
    .catch(() => null);
  if (!result || (result.error && result.error.status !== 401)) {
    throw new Error("暂时无法退出，请重试。");
  }
}
