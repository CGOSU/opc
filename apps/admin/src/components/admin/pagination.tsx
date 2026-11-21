import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const pageSizes = [10, 20, 50] as const;
export type PageSize = (typeof pageSizes)[number];

export function Pagination({
  page,
  pageSize,
  total,
  showPageNumbers = false,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: PageSize;
  total: number;
  showPageNumbers?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  const nearby = Array.from(
    { length: Math.min(3, pageCount) },
    (_, index) => start + index,
  );
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="分页"
      className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm"
    >
      <p className="tabular-nums text-muted-foreground" role="status">
        {total > 0 ? (
          <>
            显示第 <strong className="font-semibold text-foreground">{from}–{to}</strong>{" "}
            条，共 <strong className="font-semibold text-foreground">{total}</strong>{" "}
            条 · 第 {page} / {pageCount} 页
          </>
        ) : (
          "共 0 条 · 第 1 / 1 页"
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(event) => {
              const next = pageSizes.find(
                (size) => String(size) === event.currentTarget.value,
              );
              if (next !== undefined) onPageSizeChange(next);
            }}
            className="h-8 cursor-pointer rounded-[7px] border border-border bg-card px-2 font-mono text-xs text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.03)] outline-none hover:border-input focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size} 条
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-w-8 rounded-[7px] px-2"
            aria-label="上一页"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </Button>
          {showPageNumbers &&
            nearby.map((number) => (
              <Button
                key={number}
                type="button"
                variant={number === page ? "default" : "outline"}
                size="sm"
                className={cn(
                  "hidden h-8 min-w-8 rounded-[7px] px-2.5 font-mono text-xs tabular-nums lg:inline-flex",
                  number === page && "font-semibold",
                )}
                aria-label={`第 ${number} 页`}
                aria-current={number === page ? "page" : undefined}
                onClick={() => number !== page && onPageChange(number)}
              >
                {number}
              </Button>
            ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-w-8 rounded-[7px] px-2"
            aria-label="下一页"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  );
}
