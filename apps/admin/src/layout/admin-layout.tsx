import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { toast } from "sonner";
import { sessionQuery, signOut } from "../auth/api";
import { cn } from "../lib/utils";
import { AdminHeader } from "./admin-header";
import { AdminBrand, AdminSidebar } from "./admin-navigation";

const compactSidebar = "(width < 80rem)";

export function AdminLayout({ username }: { username: string }) {
  const [sidebarOverride, setSidebarOverride] = useState<boolean>();
  const [compactViewport, setCompactViewport] = useState(
    () => window.matchMedia(compactSidebar).matches,
  );
  const collapsed = sidebarOverride ?? compactViewport;
  useEffect(() => {
    const media = window.matchMedia(compactSidebar);
    const sync = () => setCompactViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
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
    <div className="flex min-h-dvh">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-card focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        跳到主要内容
      </a>
      <aside
        id="admin-sidebar"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col overflow-y-auto border-r border-border bg-card md:flex",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
        )}
      >
        <div
          className={cn(
            "flex h-header shrink-0 items-center border-b border-border",
            collapsed ? "justify-center" : "px-page",
          )}
        >
          <AdminBrand compact={collapsed} />
        </div>
        <AdminSidebar collapsed={collapsed} />
      </aside>
      <div className="min-w-0 flex-1">
        <AdminHeader
          collapsed={collapsed}
          onToggleSidebar={() => setSidebarOverride(!collapsed)}
          username={username}
          logoutPending={logout.isPending}
          onLogout={() => logout.mutate()}
        />
        <main
          id="admin-main"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-page sm:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
