import { cn } from "../lib/utils";
import type { TopicRow } from "./api";

export function TopicSelector({
  topics,
  selected,
  onChange,
}: {
  topics: TopicRow[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">所属专题</legend>
      {topics.length ? (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-control border border-border bg-background/50 p-2">
          {topics.map(({ id, title }) => {
            const checked = selected.includes(id);
            const disabled = !checked && selected.length >= 100;
            return (
              <label
                key={id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors select-none",
                  checked
                    ? "border-foreground bg-card font-medium text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.04)]"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={checked}
                  disabled={disabled}
                  onChange={({ currentTarget }) =>
                    onChange(
                      currentTarget.checked
                        ? [...selected, id]
                        : selected.filter((item) => item !== id),
                    )
                  }
                />
                <span className="min-w-0 truncate">{title}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">尚无可选专题。</p>
      )}
    </fieldset>
  );
}
