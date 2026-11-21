import MarkdownIt from "markdown-it";
import { useRef, useState } from "react";
import { cn } from "../lib/utils";

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
  const lineCount = value ? value.split("\n").length : 0;

  return (
    <section className="space-y-1.5" aria-label="正文 Markdown">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="post-content"
          className="text-sm font-medium text-foreground"
        >
          正文 Markdown
        </label>
        <div
          role="group"
          aria-label="编辑器视图切换"
          className="inline-flex rounded-control border border-border bg-background p-0.5"
        >
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
            className={cn(
              "cursor-pointer rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !preview
                ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            编辑
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
            className={cn(
              "cursor-pointer rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              preview
                ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.06)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            预览
          </button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-panel border bg-card shadow-[0_1px_2px_rgba(24,24,27,0.03)] transition-[border-color,box-shadow] duration-150 focus-within:border-foreground focus-within:ring-3 focus-within:ring-foreground/8",
          error ? "border-destructive" : "border-border",
        )}
      >
        {!preview && (
          <div
            className="flex flex-wrap items-center gap-1 border-b border-border bg-background/70 px-2.5 py-2"
            role="group"
            aria-label="Markdown 格式"
          >
            {tools.map(([label, prefix, suffix, sample]) => (
              <button
                key={label}
                type="button"
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
                className="inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {preview ? (
          <div
            className="min-h-[340px] overflow-auto wrap-anywhere bg-card p-5 [&>*+*]:mt-3 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3.5 [&_blockquote]:text-muted-foreground [&_h2]:text-xl [&_h2,&_h3]:font-semibold [&_h3]:text-lg [&_ol]:list-decimal [&_ol,&_ul]:ps-6 [&_pre]:overflow-auto [&_pre]:rounded-control [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:p-3.5 [&_td,&_th]:border [&_td,&_th]:border-border [&_td,&_th]:px-2.5 [&_td,&_th]:py-1.5 [&_ul]:list-disc"
            dangerouslySetInnerHTML={{
              __html: value.trim()
                ? markdown.render(value)
                : "<p class='text-muted-foreground'>暂无正文内容可预览。</p>",
            }}
          />
        ) : (
          <textarea
            id="post-content"
            ref={ref}
            rows={15}
            maxLength={100_000}
            placeholder="使用 Markdown 编写技术文章正文…"
            className="min-h-[340px] w-full resize-y border-0 bg-card p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/75"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={!!error}
            aria-describedby={error ? "post-content-error" : undefined}
            required
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background/60 px-3.5 py-2 text-xs text-muted-foreground">
          <span>支持 Markdown 语法 · 切换「预览」可实时检查排版</span>
          <span className="font-mono tabular-nums">
            {value.length.toLocaleString("zh-CN")} / 100,000 字符 · {lineCount}{" "}
            行
          </span>
        </div>
      </div>

      {error && (
        <p id="post-content-error" className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
