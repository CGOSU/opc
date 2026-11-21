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
      <legend className="font-medium">所属专题</legend>
      {topics.length ? (
        <div className="flex max-h-48 flex-wrap gap-x-5 gap-y-3 overflow-y-auto p-1">
          {topics.map(({ id, title }) => (
            <label key={id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(id)}
                disabled={!selected.includes(id) && selected.length >= 100}
                onChange={({ currentTarget }) =>
                  onChange(
                    currentTarget.checked
                      ? [...selected, id]
                      : selected.filter((item) => item !== id),
                  )
                }
              />
              {title}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">尚无可选专题。</p>
      )}
    </fieldset>
  );
}
