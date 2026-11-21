import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_PATTERN,
} from "@opc/api/credential-rules";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { sessionQuery, signIn, type SignInValues } from "./api";

const usernameHint = "请输入 4–32 个英文字母、数字或下划线。";
const passwordHint = `请输入 ${PASSWORD_MIN}–${PASSWORD_MAX} 个字符。`;

export function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
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
    <section
      className="w-full max-w-[400px]"
      aria-labelledby="login-heading"
    >
      <div className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_8px_24px_-8px_rgba(24,24,27,0.08),0_1px_3px_rgba(24,24,27,0.04)]">
        <div className="border-b border-border bg-background/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-control bg-primary font-mono text-xs font-bold tracking-tighter text-primary-foreground shadow-[0_1px_2px_rgba(24,24,27,0.16)]"
            >
              OP
            </span>
            <div className="min-w-0">
              <h1
                id="login-heading"
                className="text-xl font-bold tracking-tight text-foreground"
              >
                登录 OPC Admin
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                双语内容与站点管理控制台
              </p>
            </div>
          </div>
        </div>

        <form
          className="space-y-4 p-6"
          noValidate
          onSubmit={handleSubmit((values) => result.mutate(values))}
          aria-busy={result.isPending}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-foreground"
            >
              管理员用户名
            </label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="请输入管理员用户名"
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
              <p id="username-error" className="text-xs text-destructive">
                {errors.username.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              密码
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="请输入管理员密码"
                className="pr-10"
                required
                readOnly={result.isPending}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                {...register("password", {
                  required: "请输入密码。",
                  minLength: { value: PASSWORD_MIN, message: passwordHint },
                  maxLength: { value: PASSWORD_MAX, message: passwordHint },
                })}
              />
              <button
                type="button"
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                aria-pressed={showPassword}
                disabled={result.isPending}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff size={15} aria-hidden="true" />
                ) : (
                  <Eye size={15} aria-hidden="true" />
                )}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {result.error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-control border border-destructive-border bg-destructive-surface px-3 py-2.5 text-xs text-destructive sm:text-sm"
            >
              <AlertCircle
                size={15}
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              <p>{result.error.message}</p>
            </div>
          )}

          <div className="pt-1">
            <Button
              type="submit"
              className="w-full"
              disabled={result.isPending}
            >
              {result.isPending ? (
                <>
                  <LoaderCircle
                    size={15}
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                  <span>正在验证并登录…</span>
                </>
              ) : (
                <>
                  <span>登录管理后台</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock size={12} aria-hidden="true" className="shrink-0" />
        <span>单管理员会话 · 8 小时有效 · 同源 CSRF 保护</span>
      </p>
    </section>
  );
}
