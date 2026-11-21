import { Search, X } from "lucide-react";
import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function SearchInput({
  label,
  shortcutHint,
  onClear,
  className,
  value,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "aria-label"> & {
  label: string;
  shortcutHint?: string;
  onClear?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasValue = typeof value === "string" && value.length > 0;

  useEffect(() => {
    if (!shortcutHint) return;
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === shortcutHint &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isEditableElement(event.target)
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcutHint]);

  return (
    <div className="relative min-w-0">
      <Search
        size={15}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        {...props}
        value={value}
        type="search"
        aria-label={label}
        className={cn(
          "pl-9",
          (shortcutHint || (onClear && hasValue)) && "pr-9",
          className,
        )}
      />
      {onClear && hasValue ? (
        <button
          type="button"
          aria-label="清空搜索"
          onClick={onClear}
          className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X size={13} aria-hidden="true" />
        </button>
      ) : shortcutHint ? (
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground sm:inline-block"
        >
          {shortcutHint}
        </kbd>
      ) : null}
    </div>
  );
}
