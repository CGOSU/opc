import {
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { Link, NavLink } from "react-router";
import { cn } from "../lib/utils";

export const dashboardPath = "/";
export const sessionPath = "/session";
export const settingsPath = "/settings";

export const adminSections = [
  {
    label: "概览",
    pages: [{ path: dashboardPath, label: "工作台", icon: LayoutDashboard }],
  },
  {
    label: "内容管理",
    pages: [
      { path: "/posts", label: "文章管理", icon: FileText },
      { path: "/topics", label: "专题管理", icon: Layers },
      { path: "/categories", label: "分类管理", icon: FolderOpen },
      { path: "/tags", label: "标签管理", icon: Tags },
    ],
  },
  {
    label: "系统",
    pages: [
      { path: settingsPath, label: "基本设置", icon: Settings2 },
      { path: sessionPath, label: "管理员账户", icon: ShieldCheck },
    ],
  },
];

export function AdminBrand({
  compact = false,
  showStatus = true,
}: {
  compact?: boolean;
  showStatus?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        compact ? "justify-center" : "w-full justify-between gap-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-primary font-mono text-xs font-bold tracking-tighter text-primary-foreground shadow-[0_1px_2px_rgba(24,24,27,0.16)]"
        >
          OP
        </span>
        {compact ? (
          <span className="sr-only">OPC Admin</span>
        ) : (
          <div className="min-w-0">
            <span className="block truncate text-[14.5px] leading-tight font-bold tracking-tight text-foreground">
              OPC Admin
            </span>
            <span className="mt-0.5 block truncate font-mono text-[10.5px] leading-tight text-muted-foreground">
              Content Studio · D1
            </span>
          </div>
        )}
      </div>
      {!compact && showStatus && (
        <span
          title="D1 本地/边缘运行环境"
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-emerald-600 shadow-[0_0_0_3px_var(--color-success-surface)]"
        />
      )}
    </div>
  );
}

export function AdminSidebar({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="后台导航"
      className={cn("flex-1 space-y-5 py-4", collapsed ? "px-2" : "px-3")}
    >
      {adminSections.map(({ label, pages }) => (
        <div key={label}>
          <p
            className={
              collapsed
                ? "sr-only"
                : "px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground"
            }
          >
            {label}
          </p>
          <div className="space-y-1">
            {pages.map(({ path, label, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path !== "/posts" && path !== "/topics"}
                title={collapsed ? label : undefined}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "flex min-h-9 items-center gap-2.5 rounded-control text-[13.5px] outline-none transition-[background-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed ? "justify-center" : "px-3",
                    isActive
                      ? "bg-accent font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                      : "font-medium text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                  )
                }
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                <span className={collapsed ? "sr-only" : "truncate"}>
                  {label}
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SidebarAccountCard({
  username,
  collapsed = false,
  onNavigate,
}: {
  username: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const initial = Array.from(username)[0]?.toUpperCase() ?? "A";
  return (
    <div className="mt-auto border-t border-border p-3">
      <Link
        to={sessionPath}
        title={collapsed ? `${username}（管理员账户）` : undefined}
        aria-label={`管理员账户：${username}`}
        onClick={onNavigate}
        className={cn(
          "flex items-center rounded-control border border-border bg-background/80 transition-[background-color,border-color] duration-150 outline-none hover:border-input hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center p-1.5" : "gap-2.5 p-2",
        )}
      >
        <span
          aria-hidden="true"
          className="grid size-7.5 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-foreground">
              {username}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              系统管理员
            </div>
          </div>
        )}
      </Link>
    </div>
  );
}
