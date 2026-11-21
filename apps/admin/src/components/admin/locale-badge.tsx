import { cn } from "../../lib/utils";

const languageLabels = { zh: "中文", en: "English" } as const;

export function localeBadgeClass(
  exists: boolean,
  variant: "default" | "compact" = "default",
  missingStyle: "plus" | "dash" = "plus",
) {
  return cn(
    "inline-flex items-center whitespace-nowrap rounded-md border font-mono font-semibold tabular-nums transition-colors duration-150",
    variant === "compact" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
    exists
      ? "border-success-border bg-success-surface text-success"
      : missingStyle === "plus"
        ? "border-warning-border bg-warning-surface text-warning"
        : "border-dashed border-input bg-card text-muted-foreground",
  );
}

export function LocaleBadge({
  locale,
  exists,
  variant = "default",
  missingStyle = "plus",
  className,
}: {
  locale: "zh" | "en";
  exists: boolean;
  variant?: "default" | "compact";
  missingStyle?: "plus" | "dash";
  className?: string;
}) {
  const stateLabel = exists ? "已发布" : "未创建";
  const missingGlyph = missingStyle === "plus" ? "+" : "–";
  return (
    <span
      title={`${languageLabels[locale]}：${stateLabel}`}
      className={cn(localeBadgeClass(exists, variant, missingStyle), className)}
    >
      <span aria-hidden="true">
        {locale.toUpperCase()} {exists ? "✓" : missingGlyph}
      </span>
      <span className="sr-only">
        {languageLabels[locale]}
        {stateLabel}
      </span>
    </span>
  );
}
