import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from "@opc/api/credential-rules";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { sessionQuery, signIn, type SignInValues } from "./api";

const usernameHint = "请输入 4–32 个英文字母、数字或下划线。";
const passwordHint = `请输入 ${PASSWORD_MIN}–${PASSWORD_MAX} 个字符。`;

export function SignIn() {
  const queryClient = useQueryClient();
  const result = useMutation({
    mutationFn: signIn,
    gcTime: 0,
    async onSuccess(identity) {
      await queryClient.cancelQueries(sessionQuery);
      queryClient.setQueryData(sessionQuery.queryKey, identity);
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>();

  return (
    <section className="w-full max-w-sm" aria-labelledby="login-heading">
      <h1 id="login-heading" className="text-2xl font-semibold tracking-tight">
        登录管理后台
      </h1>
      <p className="mt-2 text-muted-foreground">使用管理员账户继续。</p>
      <form
        className="mt-7 space-y-5 rounded-panel border border-border bg-card p-5 shadow-xs sm:p-6"
        noValidate
        onSubmit={handleSubmit((values) => result.mutate(values))}
        aria-busy={result.isPending}
      >
        <div className="space-y-2">
          <label htmlFor="username" className="block font-medium" lang="en">
            Username
          </label>
          <Input
            id="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            readOnly={result.isPending}
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? "username-error" : undefined}
            {...register("username", {
              required: "请输入用户名。",
              minLength: { value: USERNAME_MIN, message: usernameHint },
              maxLength: { value: USERNAME_MAX, message: usernameHint },
              pattern: {
                value: new RegExp(USERNAME_PATTERN),
                message: usernameHint,
              },
            })}
          />
          {errors.username && (
            <p id="username-error" className="text-destructive">
              {errors.username.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="block font-medium" lang="en">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            readOnly={result.isPending}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password", {
              required: "请输入密码。",
              minLength: { value: PASSWORD_MIN, message: passwordHint },
              maxLength: { value: PASSWORD_MAX, message: passwordHint },
            })}
          />
          {errors.password && (
            <p id="password-error" className="text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        {result.error && (
          <p
            role="alert"
            className="rounded-control bg-destructive-surface px-3 py-2 text-destructive"
          >
            {result.error.message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={result.isPending}>
          {result.isPending ? "正在登录…" : "登录"}
          {!result.isPending && <ArrowRight size={16} aria-hidden="true" />}
        </Button>
      </form>
    </section>
  );
}
