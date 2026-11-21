import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Ellipsis, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ConfirmDialog } from "../components/admin/confirm-dialog";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { taxonomyKey } from "../taxonomy/api";
import { topicsKey } from "../topics/api";
import { deletePost, postsKey, type PostRow } from "./api";

const date = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const language = { zh: "中文", en: "English" };
const locales = ["zh", "en"] as const;
const webOrigin =
  import.meta.env.VITE_PUBLIC_SITE_ORIGIN || "http://localhost:4321";
const menuItem =
  "flex min-h-control cursor-default items-center gap-2 rounded-control px-2 outline-none data-highlighted:bg-accent";

function editPath(id: string) {
  return `/posts/${encodeURIComponent(id)}/edit`;
}

function UpdatedAt({ value }: { value: string }) {
  return (
    <time
      dateTime={value}
      className="whitespace-nowrap text-muted-foreground tabular-nums"
    >
      {date.format(new Date(value))}
    </time>
  );
}

function PostActions({ post }: { post: PostRow }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const openingConfirmation = useRef(false);
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      setOpen(false);
      toast.success("文章版本已删除");
      void cache.invalidateQueries({ queryKey: postsKey });
      void cache.invalidateQueries({ queryKey: topicsKey });
      void cache.invalidateQueries({ queryKey: taxonomyKey("categories") });
      void cache.invalidateQueries({ queryKey: taxonomyKey("tags") });
    },
  });
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            ref={trigger}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${post.title}：更多操作`}
          >
            <Ellipsis size={18} aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-20 min-w-36 rounded-control border border-border bg-card p-1 shadow-md"
            onCloseAutoFocus={(event) => {
              if (openingConfirmation.current) event.preventDefault();
              openingConfirmation.current = false;
            }}
          >
            <DropdownMenu.Item asChild className={menuItem}>
              <Link to={editPath(post.id)}>
                <Pencil size={15} aria-hidden="true" /> 编辑
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild className={menuItem}>
              <a
                href={new URL(post.path, webOrigin).href}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} aria-hidden="true" /> 在前台查看
              </a>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              className={cn(menuItem, "text-destructive")}
              onSelect={() => {
                openingConfirmation.current = true;
                setOpen(true);
              }}
            >
              <Trash2 size={15} aria-hidden="true" /> 删除版本
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ConfirmDialog
        returnFocusRef={trigger}
        title={`永久删除${language[post.locale]}版本？`}
        description={`“${post.title}”的这个语言版本及其旧地址将永久删除。其他语言版本不受影响。`}
        confirmLabel="永久删除"
        open={open}
        onOpenChange={(next) => {
          remove.reset();
          setOpen(next);
        }}
        pending={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

export const postColumns: ColumnDef<PostRow>[] = [
  {
    id: "title",
    header: "文章标题",
    cell: ({ row: { original: post } }) => (
      <div className="min-w-0 max-w-md lg:min-w-44">
        <Link
          to={editPath(post.id)}
          className="block font-semibold wrap-anywhere underline-offset-4 hover:underline focus-visible:underline"
        >
          {post.title}
        </Link>
        <p className="mt-1 text-xs lg:hidden">
          <UpdatedAt value={post.updatedAt} /> · {language[post.locale]}
        </p>
        <p
          className="mt-1 hidden truncate text-xs text-muted-foreground lg:block"
          title={post.summary || post.slug}
        >
          {language[post.locale]} · {post.summary || post.slug}
        </p>
      </div>
    ),
  },
  {
    id: "category",
    header: "分类",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.category ?? "—"}
      </span>
    ),
  },
  {
    id: "tags",
    header: "标签",
    cell: ({ row }) =>
      row.original.tags.length ? (
        <ul className="flex max-w-44 flex-wrap gap-1">
          {row.original.tags.map(({ id, name }) => (
            <li
              key={id}
              className="max-w-full truncate rounded-control border border-border px-2 py-0.5 text-xs"
              title={name}
            >
              {name}
            </li>
          ))}
        </ul>
      ) : (
        "—"
      ),
  },
  {
    id: "topics",
    header: "专题",
    cell: ({ row }) => (
      <span
        className="whitespace-nowrap text-muted-foreground"
        title={
          row.original.topics.map(({ title }) => title).join("、") || undefined
        }
      >
        {row.original.topics.length
          ? `${row.original.topics.length} 个专题`
          : "—"}
      </span>
    ),
  },
  {
    id: "translations",
    header: "语言版本",
    cell: ({ row }) => (
      <div className="flex gap-1">
        {locales.map((locale) => {
          const exists =
            row.original.locale === locale ||
            row.original.translations.some((entry) => entry.locale === locale);
          return (
            <span
              key={locale}
              className={cn(
                "whitespace-nowrap rounded-control border px-1.5 py-0.5 text-xs",
                exists
                  ? "border-transparent bg-accent"
                  : "border-dashed border-input text-muted-foreground",
              )}
            >
              <span aria-hidden="true">
                {locale.toUpperCase()} {exists ? "✓" : "–"}
              </span>
              <span className="sr-only">
                {language[locale]}
                {exists ? "已发布" : "未创建"}
              </span>
            </span>
          );
        })}
      </div>
    ),
  },
  {
    accessorKey: "updatedAt",
    header: "更新时间",
    cell: ({ row }) => <UpdatedAt value={row.original.updatedAt} />,
  },
  {
    id: "actions",
    header: "操作",
    cell: ({ row }) => <PostActions post={row.original} />,
  },
];

export function postColumnClass(column: string) {
  switch (column) {
    case "tags":
      return "hidden min-[90rem]:table-cell";
    case "title":
      return "w-full sm:w-auto";
    case "actions":
      return "w-12 text-center";
    default:
      return "hidden lg:table-cell";
  }
}
