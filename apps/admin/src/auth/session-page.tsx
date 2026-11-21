import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  Settings2,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { PageHeader } from "../components/admin/page-header";
import { Button, buttonVariants } from "../components/ui/button";
import { sessionQuery, signOut } from "./api";

const securityMechanisms = [
  {
    title: "密码哈希派生",
    detail: "Workers 原生 PBKDF2-HMAC-SHA-256（100,000 次迭代 · 128-bit 随机盐）",
  },
  {
    title: "服务端会话令牌",
    detail: "D1 仅持久化会话 Token 的 SHA-256 摘要，不落盘原始令牌",
  },
  {
    title: "登录速率限制",
    detail: "每来源 IP 每 5 分钟最多 8 次有效格式登录尝试（D1 原子计数）",
  },
  {
    title: "管理写请求防护",
    detail: "严格匹配同源 ADMIN_ORIGIN，并强制校验 X-OPC-CSRF 请求头",
  },
] as const;

export function SessionPage({ username }: { username: string }) {
  const initial = Array.from(username)[0]?.toUpperCase() ?? "A";
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: signOut,
    onError: (error) => toast.error(error.message),
    async onSuccess() {
      await queryClient.cancelQueries(sessionQuery);
      queryClient.setQueryData(sessionQuery.queryKey, null);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理员账户"
        description="查看当前已认证管理员会话、凭据方式与服务端安全策略。"
      />

      <section
        aria-labelledby="account-profile-heading"
        className="flex flex-col gap-4 rounded-panel border border-border bg-card p-5 shadow-[0_1px_3px_rgba(24,24,27,0.04)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-[0_1px_2px_rgba(24,24,27,0.14)]"
          >
            {initial}
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="account-profile-heading"
                className="truncate text-lg font-bold tracking-tight text-foreground"
              >
                {username}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-surface px-2.5 py-0.5 text-xs font-medium text-success">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-success"
                />
                会话有效 · 已认证
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                系统管理员
              </span>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              拥有全站文章、专题、分类、标签与双语站点设置的完整管理权限
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          className="border-destructive-border text-destructive hover:border-destructive-border hover:bg-destructive-surface"
        >
          <LogOut size={15} aria-hidden="true" />
          {logout.isPending ? "正在退出…" : "退出当前会话"}
        </Button>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="session-info-heading"
          className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
        >
          <header className="flex items-center gap-2.5 border-b border-border bg-background/60 px-5 py-3.5">
            <ShieldCheck
              size={16}
              aria-hidden="true"
              className="text-foreground"
            />
            <h2
              id="session-info-heading"
              className="text-sm font-semibold text-foreground"
            >
              会话与身份信息
            </h2>
          </header>
          <dl className="divide-y divide-border px-5 text-sm">
            <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-center gap-4 py-3.5">
              <dt className="text-muted-foreground">用户名</dt>
              <dd className="min-w-0">
                <code className="inline-block max-w-full break-all rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                  {username}
                </code>
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-center gap-4 py-3.5">
              <dt className="text-muted-foreground">权限角色</dt>
              <dd className="font-medium text-foreground">
                单管理员（全站内容与配置读写）
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-start gap-4 py-3.5">
              <dt className="text-muted-foreground">会话策略</dt>
              <dd className="text-foreground">
                固定有效 <span className="font-mono tabular-nums">8</span>{" "}
                小时，退出登录时立即销毁服务端会话记录
              </dd>
            </div>
            <div className="grid grid-cols-[minmax(5.5rem,auto)_minmax(0,1fr)] items-start gap-4 py-3.5">
              <dt className="text-muted-foreground">密码管理</dt>
              <dd className="space-y-1.5 text-muted-foreground">
                <p>后台不提供用户名或密码的在线修改入口。</p>
                <p className="flex items-center gap-1.5 text-xs">
                  <Terminal size={13} aria-hidden="true" className="shrink-0" />
                  <span>
                    本地环境通过{" "}
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      bun run admin:create:local
                    </code>{" "}
                    初始化账户
                  </span>
                </p>
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="security-policy-heading"
          className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
        >
          <header className="flex items-center gap-2.5 border-b border-border bg-background/60 px-5 py-3.5">
            <Lock size={16} aria-hidden="true" className="text-foreground" />
            <h2
              id="security-policy-heading"
              className="text-sm font-semibold text-foreground"
            >
              安全防护机制
            </h2>
          </header>
          <ul className="divide-y divide-border px-5">
            {securityMechanisms.map(({ title, detail }) => (
              <li key={title} className="flex items-start gap-3 py-3.5">
                <CheckCircle2
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-success"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section
        aria-label="常用管理入口"
        className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-card px-5 py-3.5 shadow-[0_1px_2px_rgba(24,24,27,0.03)]"
      >
        <p className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <KeyRound size={15} aria-hidden="true" className="shrink-0" />
          <span>如需调整双语站名或全站默认 SEO 描述，可前往系统设置。</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft size={14} aria-hidden="true" />
            返回工作台
          </Link>
          <Link to="/settings" className={buttonVariants({ size: "sm" })}>
            <Settings2 size={14} aria-hidden="true" />
            基本设置
          </Link>
        </div>
      </section>
    </div>
  );
}
