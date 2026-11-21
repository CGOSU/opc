import * as Dialog from "@radix-ui/react-dialog";
import {
  CornerDownLeft,
  ExternalLink,
  FilePlus2,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { publicSiteOrigin } from "../lib/admin-api";
import { cn } from "../lib/utils";
import { dashboardPath, sessionPath, settingsPath } from "./admin-navigation";

type CommandItem = {
  id: string;
  group: string;
  label: string;
  keywords: string;
  icon: LucideIcon;
  to?: string;
  externalHref?: string;
};

const commands: CommandItem[] = [
  {
    id: "dashboard",
    group: "页面导航",
    label: "工作台",
    keywords: "dashboard overview home 概览 统计",
    icon: LayoutDashboard,
    to: dashboardPath,
  },
  {
    id: "posts",
    group: "页面导航",
    label: "文章管理",
    keywords: "posts articles list 文章 列表 双语",
    icon: FileText,
    to: "/posts",
  },
  {
    id: "topics",
    group: "页面导航",
    label: "专题管理",
    keywords: "topics collections 专题 合集 排序",
    icon: Layers,
    to: "/topics",
  },
  {
    id: "categories",
    group: "页面导航",
    label: "分类管理",
    keywords: "categories taxonomy 分类 seo",
    icon: FolderOpen,
    to: "/categories",
  },
  {
    id: "tags",
    group: "页面导航",
    label: "标签管理",
    keywords: "tags taxonomy 标签 seo",
    icon: Tags,
    to: "/tags",
  },
  {
    id: "settings",
    group: "系统与账户",
    label: "基本设置",
    keywords: "settings seo site name 站名 描述",
    icon: Settings2,
    to: settingsPath,
  },
  {
    id: "session",
    group: "系统与账户",
    label: "管理员账户",
    keywords: "session account profile 管理员 会话 安全",
    icon: ShieldCheck,
    to: sessionPath,
  },
  {
    id: "new-post",
    group: "快捷操作",
    label: "新建文章",
    keywords: "create new post markdown 新建 写作",
    icon: FilePlus2,
    to: "/posts/new",
  },
  {
    id: "new-topic",
    group: "快捷操作",
    label: "新建专题",
    keywords: "create new topic 新建 专题",
    icon: Plus,
    to: "/topics/new",
  },
  {
    id: "visit-site",
    group: "快捷操作",
    label: "访问前台站点",
    keywords: "frontend site preview 前台 预览 网站",
    icon: ExternalLink,
    externalHref: publicSiteOrigin,
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? commands.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          item.group.toLowerCase().includes(normalized) ||
          item.keywords.toLowerCase().includes(normalized),
      )
    : commands;
  const boundedIndex =
    filtered.length === 0 ? -1 : Math.min(activeIndex, filtered.length - 1);

  function closeAndReset() {
    setQuery("");
    setActiveIndex(0);
    onOpenChange(false);
  }

  function runCommand(item: CommandItem) {
    closeAndReset();
    if (item.to) {
      void navigate(item.to);
    } else if (item.externalHref) {
      window.open(item.externalHref, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setActiveIndex(0);
        }
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-4 top-[14%] z-50 mx-auto max-w-lg overflow-hidden rounded-panel border border-border bg-card shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">快速跳转命令面板</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-3.5">
            <Search
              size={16}
              aria-hidden="true"
              className="shrink-0 text-muted-foreground"
            />
            <input
              type="search"
              autoFocus
              value={query}
              aria-label="搜索功能或页面"
              placeholder="输入页面名称或操作，如「新建文章」「SEO」…"
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" && filtered.length) {
                  event.preventDefault();
                  setActiveIndex((current) => (current + 1) % filtered.length);
                } else if (event.key === "ArrowUp" && filtered.length) {
                  event.preventDefault();
                  setActiveIndex(
                    (current) =>
                      (current - 1 + filtered.length) % filtered.length,
                  );
                } else if (
                  event.key === "Enter" &&
                  boundedIndex >= 0 &&
                  filtered[boundedIndex]
                ) {
                  event.preventDefault();
                  runCommand(filtered[boundedIndex]);
                }
              }}
            />
            <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2" role="listbox">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                未找到匹配的页面或快捷操作
              </p>
            ) : (
              filtered.map((item, index) => {
                const Icon = item.icon;
                const active = index === boundedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(item)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors duration-100 outline-none",
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-foreground hover:bg-accent/70",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.group}</span>
                      {active && (
                        <CornerDownLeft size={13} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
