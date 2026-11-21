import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { sessionQuery } from "./auth/api";
import { SessionPage } from "./auth/session-page";
import { SignIn } from "./auth/sign-in";
import { ErrorState, LoadingState } from "./components/admin/states";
import { buttonVariants } from "./components/ui/button";
import {
  AdminBrand,
  dashboardPath,
  sessionPath,
  settingsPath,
} from "./layout/admin-navigation";
import { publicSiteOrigin } from "./lib/admin-api";
import { cn } from "./lib/utils";

const DashboardPage = lazy(() => import("./dashboard/dashboard-page"));
const SettingsPage = lazy(() => import("./settings/settings-page"));

const TaxonomyPage = lazy(async () => {
  const { TaxonomyPage } = await import("./taxonomy/taxonomy-page");
  return { default: TaxonomyPage };
});

const PostsPage = lazy(() => import("./posts/posts-page"));
const PostEditor = lazy(() => import("./posts/post-editor"));
const TopicsPage = lazy(() =>
  import("./topics/topics-page").then(({ TopicsPage }) => ({
    default: TopicsPage,
  })),
);
const TopicEditor = lazy(() =>
  import("./topics/topic-editor").then(({ TopicEditor }) => ({
    default: TopicEditor,
  })),
);

const AdminLayout = lazy(async () => {
  const { AdminLayout } = await import("./layout/admin-layout");
  return { default: AdminLayout };
});

function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-grid-bg flex min-h-dvh flex-col">
      <header className="flex h-header items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-xs sm:px-page">
        <div className="min-w-0">
          <AdminBrand showStatus={false} />
        </div>
        <a
          href={publicSiteOrigin}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "h-8 rounded-[7px]",
          )}
        >
          <ExternalLink size={13} aria-hidden="true" />
          <span>访问前台</span>
        </a>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-10 sm:px-page sm:py-12">
        {children}
      </main>
    </div>
  );
}

export function App() {
  const session = useQuery(sessionQuery);

  if (session.isPending) {
    return (
      <EntryLayout>
        <LoadingState message="正在检查登录状态…" />
      </EntryLayout>
    );
  }

  if (session.isError) {
    return (
      <EntryLayout>
        <div className="w-full max-w-sm rounded-panel border border-border bg-card p-6 shadow-sm">
          <ErrorState
            message="无法检查登录状态。"
            onRetry={() => void session.refetch()}
            retrying={session.isFetching}
          />
        </div>
      </EntryLayout>
    );
  }

  return (
    <>
      <Toaster position="bottom-right" closeButton className="admin-toaster" />
      <Routes>
        <Route
          path="/login"
          element={
            session.data ? (
              <Navigate replace to={dashboardPath} />
            ) : (
              <EntryLayout>
                <SignIn />
              </EntryLayout>
            )
          }
        />
        <Route
          element={
            session.data ? (
              <Suspense
                fallback={
                  <EntryLayout>
                    <LoadingState message="正在打开后台…" />
                  </EntryLayout>
                }
              >
                <AdminLayout username={session.data.username} />
              </Suspense>
            ) : (
              <Navigate replace to="/login" />
            )
          }
        >
          <Route path={dashboardPath} element={<DashboardPage />} />
          <Route path={settingsPath} element={<SettingsPage />} />
          {session.data && (
            <Route
              path={sessionPath}
              element={<SessionPage username={session.data.username} />}
            />
          )}
          <Route
            path="/categories"
            element={<TaxonomyPage key="categories" kind="categories" />}
          />
          <Route
            path="/tags"
            element={<TaxonomyPage key="tags" kind="tags" />}
          />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/posts/new" element={<PostEditor />} />
          <Route path="/posts/:id/edit" element={<PostEditor />} />
          <Route path="/topics" element={<TopicsPage />} />
          <Route path="/topics/new" element={<TopicEditor />} />
          <Route path="/topics/:id" element={<TopicEditor />} />
          <Route path="*" element={<Navigate replace to={dashboardPath} />} />
        </Route>
      </Routes>
    </>
  );
}
