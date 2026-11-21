import { flexRender, type Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { EmptyState } from "./states";

export function DataTable<T>({
  table,
  label,
  empty = <EmptyState title="暂无数据" />,
  columnClassName,
  rowClassName,
  footer,
}: {
  table: Table<T>;
  label: string;
  empty?: ReactNode;
  columnClassName?: (column: string) => string | undefined;
  rowClassName?: string;
  footer?: ReactNode;
}) {
  const rows = table.getRowModel().rows;
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-card shadow-[0_1px_3px_rgba(24,24,27,0.04)]">
      <div
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-ring"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{label}</caption>
          <thead className="border-b border-border bg-background/90 text-xs font-semibold text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const Icon =
                    sorted === "asc"
                      ? ArrowUp
                      : sorted === "desc"
                        ? ArrowDown
                        : ArrowUpDown;
                  const text = flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  );
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      scope={header.subHeaders.length ? "colgroup" : "col"}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "h-10.5 whitespace-nowrap px-4 py-1 font-semibold",
                        columnClassName?.(header.column.id),
                      )}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="-ml-2 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {text}
                          <Icon size={13} aria-hidden="true" />
                        </Button>
                      ) : (
                        text
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(1, table.getVisibleLeafColumns().length)}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-100 hover:bg-background/80"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "h-table-row px-4 py-2.5",
                        rowClassName,
                        columnClassName?.(cell.column.id),
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-border bg-background/60 px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
