import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  LibraryBig,
  Settings2,
  ShieldCheck,
  Diamond,
  Tags,
} from "lucide-react";
import { NavLink } from "react-router";
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
      { path: "/topics", label: "专题管理", icon: LibraryBig },
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

export function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight",
        compact && "justify-center",
      )}
    >
      <Diamond size={20} aria-hidden="true" className="shrink-0 text-primary" />
      <span className={compact ? "sr-only" : "whitespace-nowrap"}>
        OPC Admin
      </span>
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
      className={cn("space-y-5 py-5", collapsed ? "px-2" : "px-3")}
    >
      {adminSections.map(({ label, pages }) => (
        <div key={label}>
          <p
            className={
              collapsed
                ? "sr-only"
                : "px-3 pb-2 text-xs font-medium text-muted-foreground"
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
                    "flex min-h-10 items-center gap-2.5 rounded-control text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed ? "justify-center" : "px-3",
                    isActive
                      ? "bg-accent font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                  )
                }
              >
                <Icon size={18} aria-hidden="true" className="shrink-0" />
                <span className={collapsed ? "sr-only" : undefined}>
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
