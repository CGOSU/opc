import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

// shadcn/ui base-nova primitives, styled with the admin's existing tokens.
export const DropdownMenu = MenuPrimitive.Root;

export function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

export function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  collisionPadding,
  positionerClassName,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<
    MenuPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "collisionPadding"
  > & { positionerClassName?: string }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className={cn("z-20 outline-none", positionerClassName)}
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={(state) =>
            cn(
              "min-w-36 rounded-control border border-border bg-card p-1 shadow-lg outline-none",
              typeof className === "function" ? className(state) : className,
            )
          }
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

export function DropdownMenuLabel(props: MenuPrimitive.GroupLabel.Props) {
  return (
    <MenuPrimitive.GroupLabel data-slot="dropdown-menu-label" {...props} />
  );
}

export function DropdownMenuItem(props: MenuPrimitive.Item.Props) {
  return <MenuPrimitive.Item data-slot="dropdown-menu-item" {...props} />;
}

export function DropdownMenuLinkItem(props: MenuPrimitive.LinkItem.Props) {
  return <MenuPrimitive.LinkItem data-slot="dropdown-menu-item" {...props} />;
}

export function DropdownMenuSeparator(props: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator data-slot="dropdown-menu-separator" {...props} />
  );
}
