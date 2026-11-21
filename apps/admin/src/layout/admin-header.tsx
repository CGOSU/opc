import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { matchPath, useLocation } from "react-router";
import { Button } from "../components/ui/button";
import { AdminSidebar, adminSections } from "./admin-navigation";

function MobileNavigation() {
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
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-sidebar max-w-[calc(100vw-3rem)] flex-col border-r border-border bg-card shadow-lg outline-none md:hidden"
        >
          <div className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <Dialog.Title className="font-semibold">OPC Admin</Dialog.Title>
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
          <div className="min-h-0 overflow-y-auto">
            <AdminSidebar onNavigate={() => setOpen(false)} />
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
          <span className="hidden truncate sm:inline">{username}</span>
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold"
          >
            {Array.from(username)[0]?.toUpperCase()}
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
          className="z-30 w-52 rounded-control border border-border bg-card p-1 shadow-md"
        >
          <DropdownMenu.Label className="break-all px-3 py-2 text-xs text-muted-foreground">
            <span className="block">管理员</span>
            <span className="mt-1 block text-sm font-medium text-foreground">
              {username}
            </span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            disabled={logoutPending}
            onSelect={onLogout}
            className="flex min-h-control cursor-default items-center gap-2 rounded-control px-3 text-sm font-medium outline-none data-disabled:opacity-60 data-highlighted:bg-accent"
          >
            <LogOut size={16} aria-hidden="true" />
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
  const matches = ({ path }: { path: string }) =>
    matchPath({ path, end: path === "/" }, pathname);
  const section = adminSections.find(({ pages }) => pages.some(matches));
  const current = section?.pages.find(matches)?.label;
  const SidebarIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-10 flex h-header min-w-0 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-page">
      <div className="flex min-w-0 items-center gap-2.5">
        <MobileNavigation />
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
          <SidebarIcon size={18} aria-hidden="true" />
        </Button>
        <nav aria-label="面包屑" className="min-w-0">
          <ol className="flex items-center gap-2 whitespace-nowrap">
            <li className="hidden text-muted-foreground sm:block">
              {section?.label ?? "后台"}
            </li>
            <li
              aria-hidden="true"
              className="hidden text-muted-foreground sm:block"
            >
              <ChevronRight size={14} />
            </li>
            <li aria-current="page" className="truncate font-medium">
              {current}
            </li>
          </ol>
        </nav>
      </div>
      <AccountMenu {...account} />
    </header>
  );
}
