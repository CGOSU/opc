import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "../ui/input";

export function SearchInput({
  label,
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "aria-label"> & {
  label: string;
}) {
  return (
    <div className="relative min-w-0">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        {...props}
        type="search"
        aria-label={label}
        className={`pl-9 ${props.className ?? ""}`}
      />
    </div>
  );
}
