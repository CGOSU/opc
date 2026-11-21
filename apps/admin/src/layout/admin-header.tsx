import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, matchPath, useLocation } from "react-router";
import { Button, buttonVariants } from "../components/ui/button";
import { publicSiteOrigin } from "../lib/admin-api";
import { cn } from "../lib/utils";
import {
  AdminBrand,
  AdminSidebar,
  adminSections,
  sessionPath,
  SidebarAccountCard,
} from "./admin-navigation";
import { CommandPalette } from "./command-palette";

type BreadcrumbItem = { label: string; to?: string };

function resolveBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (matchPath({ path: "/posts/new", end: true }, pathname)) {
    return [
      { label: "内容管理" },
      { label: "文章管理", to: "/posts" },
      { label: "新建文章" },
    ];
  }
  if (matchPath({ path: "/posts/:id/edit", end: true }, pathname)) {
    return [
      { label: "内容管理" },
      { label: "文章管理", to: "/posts" },
      { label: "编辑文章" },
    ];
  }
  if (matchPath({ path: "/topics/new", end: true }, pathname)) {
    return [
      { label: "内容管理" },
      { label: "专题管理", to: "/topics" },
      { label: "新建专题" },
    ];
  }
  if (matchPath({ path: "/topics/:id", end: true }, pathname)) {
    return [
      { label: "内容管理" },
      { label: "专题管理", to: "/topics" },
      { label: "编辑专题" },
    ];
  }
  const matches = ({ path }: { path: string }) =>
    matchPath({ path, end: path === "/" }, pathname);
  const section = adminSections.find(({ pages }) => pages.some(matches));
  const current = section?.pages.find(matches)?.label;
  return [
    { label: section?.label ?? "后台" },
    ...(current ? [{ label: current }] : []),
  ];
}

function MobileNavigation({ username }: { username: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="打开导航"
        >
          <Menu size={19} aria-hidden="true" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px] md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-sidebar max-w-[calc(100vw-3rem)] flex-col border-r border-border bg-card shadow-xl outline-none md:hidden"
        >
          <div className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <Dialog.Title className="sr-only">OPC Admin 导航</Dialog.Title>
            <AdminBrand showStatus />
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭导航"
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <AdminSidebar onNavigate={() => setOpen(false)} />
            <SidebarAccountCard
              username={username}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AccountMenu({
  username,
  logoutPending,
  onLogout,
}: Pick<AdminHeaderProps, "username" | "logoutPending" | "onLogout">) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="管理员菜单"
          className="max-w-48 px-2"
        >
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {Array.from(username)[0]?.toUpperCase()}
          </span>
          <span className="hidden truncate text-sm font-medium sm:inline">
            {username}
          </span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="shrink-0 text-muted-foreground"
          />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-30 w-56 rounded-control border border-border bg-card p-1 shadow-lg"
        >
          <DropdownMenu.Label className="break-all px-3 py-2 text-xs text-muted-foreground">
            <span className="block">系统管理员</span>
            <span className="mt-0.5 block text-sm font-semibold text-foreground">
              {username}
            </span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              to={sessionPath}
              className="flex min-h-control cursor-pointer items-center gap-2 rounded-control px-3 text-sm font-medium text-foreground outline-none data-highlighted:bg-accent"
            >
              <ShieldCheck size={15} aria-hidden="true" />
              管理员账户
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={logoutPending}
            onSelect={onLogout}
            className="flex min-h-control cursor-pointer items-center gap-2 rounded-control px-3 text-sm font-medium text-destructive outline-none data-disabled:opacity-60 data-highlighted:bg-destructive-surface"
          >
            <LogOut size={15} aria-hidden="true" />
            {logoutPending ? "正在退出…" : "退出登录"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

type AdminHeaderProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
  username: string;
  logoutPending: boolean;
  onLogout: () => void;
};

export function AdminHeader({
  collapsed,
  onToggleSidebar,
  ...account
}: AdminHeaderProps) {
  const { pathname } = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const breadcrumbs = resolveBreadcrumbs(pathname);
  const SidebarIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
      <header className="sticky top-0 z-10 flex h-header min-w-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-page">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNavigation username={account.username} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={onToggleSidebar}
            aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
            aria-controls="admin-sidebar"
            aria-expanded={!collapsed}
          >
            <SidebarIcon size={17} aria-hidden="true" />
          </Button>
          <nav aria-label="面包屑" className="min-w-0">
            <ol className="flex items-center gap-2 whitespace-nowrap text-[13px]">
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li
                    key={`${crumb.label}-${index}`}
                    className={cn(
                      "flex items-center gap-2",
                      !isLast && "hidden sm:flex",
                    )}
                  >
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="hidden text-input sm:inline"
                      >
                        /
                      </span>
                    )}
                    {crumb.to && !isLast ? (
                      <Link
                        to={crumb.to}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    ) : isLast ? (
                      <span
                        aria-current="page"
                        className="truncate font-semibold text-foreground"
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="快速跳转或搜索功能"
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-[7px] border border-border bg-background px-2.5 text-xs text-muted-foreground transition-colors duration-150 outline-none hover:border-input hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Search size={13} aria-hidden="true" />
            <span className="hidden sm:inline">快速跳转…</span>
            <kbd className="hidden rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-foreground sm:inline">
              ⌘K
            </kbd>
          </button>
          <a
            href={publicSiteOrigin}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden h-8 rounded-[7px] sm:inline-flex",
            )}
          >
            <ExternalLink size={13} aria-hidden="true" />
            <span>访问前台</span>
          </a>
          <AccountMenu {...account} />
        </div>
      </header>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
