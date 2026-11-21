import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../ui/button";

type Item = { id: string; title: string };
function SortableRow({
  item,
  disabled,
  children,
}: {
  item: Item;
  disabled: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: item.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-h-11 items-center gap-2 border-b border-border bg-card px-2 last:border-b-0"
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        {...attributes}
        {...listeners}
        aria-label={`调整「${item.title}」的顺序`}
        className="shrink-0 touch-none cursor-grab active:cursor-grabbing"
      >
        <GripVertical aria-hidden="true" />
      </Button>
      {children}
    </li>
  );
}

export function SortableList<T extends Item>({
  items,
  onChange,
  disabled,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  disabled: boolean;
  children: (item: T) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const index = (id: string | number) =>
    items.findIndex((item) => item.id === id);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "按空格拾取，使用方向键移动，再按空格放下。按 Escape 取消。",
        },
        announcements: {
          onDragStart: ({ active }) => `已拾取第 ${index(active.id) + 1} 项。`,
          onDragOver: ({ over }) =>
            over ? `已移到第 ${index(over.id) + 1} 项。` : "已移出列表。",
          onDragEnd: ({ over }) =>
            over ? `已放到第 ${index(over.id) + 1} 项。` : "顺序未改变。",
          onDragCancel: () => "已取消排序。",
        },
      }}
      onDragEnd={({ active, over }) => {
        if (disabled || !over || active.id === over.id) return;
        const from = index(active.id),
          to = index(over.id);
        if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to));
      }}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ol className="rounded-lg border border-border">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} disabled={disabled}>
              {children(item)}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
