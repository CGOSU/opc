import MarkdownIt from "markdown-it";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";

const markdown = new MarkdownIt({ html: false });
const tools = [
  ["H2", "\n## ", "\n", "标题"],
  ["H3", "\n### ", "\n", "标题"],
  ["加粗", "**", "**", "文字"],
  ["斜体", "_", "_", "文字"],
  ["链接", "[", "](https://example.com)", "链接文字"],
  ["引用", "\n> ", "\n", "引用文字"],
  ["有序列表", "\n1. ", "\n", "列表项"],
  ["无序列表", "\n- ", "\n", "列表项"],
  ["代码块", "\n```\n", "\n```\n", "code"],
  ["行内代码", "`", "`", "code"],
  ["图片", "![", "](https://example.com/image.png)", "替代文本"],
  ["表格", "\n| 列一 | 列二 |\n| --- | --- |\n| ", " | 内容 |\n", "内容"],
];

export function MarkdownEditor({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  return (
    <section className="space-y-2" aria-label="正文 Markdown">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="post-content" className="font-medium">
          正文 Markdown
        </label>
        <Button
          variant="outline"
          type="button"
          aria-pressed={preview}
          onClick={() => setPreview(!preview)}
        >
          {preview ? "继续编辑" : "预览"}
        </Button>
      </div>
      {preview ? (
        <div
          className="min-h-56 overflow-auto wrap-anywhere rounded-control border border-border p-4 [&>*+*]:mt-3 [&_h2]:text-xl [&_h3]:text-lg [&_h2,&_h3]:font-semibold [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ul]:list-disc [&_ol,&_ul]:ps-6 [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_pre]:overflow-auto [&_pre]:bg-background [&_pre]:p-3 [&_td,&_th]:border [&_td,&_th]:px-2 [&_td,&_th]:py-1"
          dangerouslySetInnerHTML={{ __html: markdown.render(value) }}
        />
      ) : (
        <>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label="Markdown 格式"
          >
            {tools.map(([label, prefix, suffix, sample]) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const field = ref.current;
                  if (!field) return;
                  const { selectionStart: start, selectionEnd: end } = field;
                  const text = value.slice(start, end) || sample;
                  const next =
                    value.slice(0, start) +
                    prefix +
                    text +
                    suffix +
                    value.slice(end);
                  if (next.length > 100_000) return;
                  onChange(next);
                  requestAnimationFrame(() => {
                    field.focus();
                    field.setSelectionRange(
                      start + prefix.length,
                      start + prefix.length + text.length,
                    );
                  });
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <textarea
            id="post-content"
            ref={ref}
            rows={14}
            maxLength={100_000}
            className="w-full rounded-control border border-border bg-card p-3 font-mono text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={!!error}
            aria-describedby={error ? "post-content-error" : undefined}
            required
          />
        </>
      )}
      {error && (
        <p id="post-content-error" className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
