import { ChevronLeft, ChevronRight } from "lucide-react";
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

  return (
    <nav
      aria-label="分页"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="tabular-nums text-muted-foreground" role="status">
        共 {total} 条 · 第 {page} / {pageCount} 页
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(event) => {
              const next = pageSizes.find(
                (size) => String(size) === event.currentTarget.value,
              );
              if (next !== undefined) onPageSizeChange(next);
            }}
            className="h-control rounded-control border border-input bg-card px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        {showPageNumbers &&
          nearby.map((number) => (
            <Button
              key={number}
              type="button"
              variant={number === page ? "default" : "outline"}
              size="icon"
              className="hidden lg:inline-flex"
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
          size="icon"
          aria-label="下一页"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
