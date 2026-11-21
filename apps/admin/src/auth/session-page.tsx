import { ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/admin/page-header";

export function SessionPage({ username }: { username: string }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="管理员账户"
        description="查看当前登录的管理员账户。密码不在后台修改。"
      />
      <section
        aria-labelledby="session-heading"
        className="max-w-xl rounded-panel border border-border bg-card"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-page">
          <span className="grid size-control shrink-0 place-items-center rounded-control bg-accent text-primary">
            <ShieldCheck size={18} aria-hidden="true" />
          </span>
          <h2 id="session-heading" className="font-semibold">
            管理员会话
          </h2>
        </header>
        <dl className="divide-y divide-border px-4 sm:px-page">
          <div className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-3 py-3.5">
            <dt className="text-muted-foreground">用户名</dt>
            <dd className="break-all font-medium">{username}</dd>
          </div>
          <div className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,2fr)] gap-3 py-3.5">
            <dt className="text-muted-foreground">状态</dt>
            <dd className="flex items-center gap-2 font-medium">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-primary"
              />
              已登录
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
