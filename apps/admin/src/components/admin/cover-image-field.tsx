import {
  ImageOff,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  COVER_ACCEPT,
  uploadCoverImage,
  validateCoverFile,
} from "../../lib/media";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

function parseHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = URL.parse(trimmed);
  return parsed && (parsed.protocol === "http:" || parsed.protocol === "https:")
    ? parsed.href
    : null;
}

export function CoverImageField({
  id,
  label,
  value,
  onChange,
  disabled = false,
  error,
  previewAlt = "封面预览",
  placeholder = "https://example.com/cover.png",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  previewAlt?: string;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const validUrl = parseHttpUrl(value);
  const busy = disabled || uploading;

  function openPicker() {
    if (!busy) fileInputRef.current?.click();
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    const validation = validateCoverFile(file);
    if (validation) {
      setUploadError(validation);
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadCoverImage(file);
      setFailedUrl(null);
      onChange(uploaded.url);
      toast.success("封面图已上传，保存设置后生效");
    } catch (caught) {
      setUploadError(
        caught instanceof Error ? caught.message : "上传失败，请重试。",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="text-[11px] text-muted-foreground">
          支持上传或外链 URL
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={COVER_ACCEPT}
        disabled={busy}
        className="sr-only"
        aria-label={`${label}文件选择`}
        onChange={(event) => {
          void handleFile(event.currentTarget.files?.[0]);
        }}
      />

      {validUrl ? (
        <div
          onDragOver={(event) => {
            if (busy) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "overflow-hidden rounded-panel border bg-background transition-colors",
            dragging ? "border-foreground ring-2 ring-foreground/15" : "border-border",
          )}
        >
          {failedUrl !== validUrl ? (
            <div className="relative bg-background">
              <img
                src={validUrl}
                alt={previewAlt}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-video w-full object-cover"
                onError={() => setFailedUrl(validUrl)}
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-card/80 text-xs font-medium text-foreground backdrop-blur-xs">
                  <LoaderCircle
                    size={16}
                    aria-hidden="true"
                    className="motion-safe:animate-spin"
                  />
                  <span>正在上传新封面…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
              <ImageOff size={20} aria-hidden="true" />
              <p>当前封面 URL 暂无法预览，可核对地址或直接上传本地图片</p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={openPicker}
            >
              <Upload size={13} aria-hidden="true" />
              {uploading ? "正在上传…" : "替换图片"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setUploadError(null);
                setFailedUrl(null);
                onChange("");
              }}
              className="text-destructive hover:bg-destructive-surface hover:text-destructive"
            >
              <Trash2 size={13} aria-hidden="true" />
              移除封面
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={openPicker}
          onDragOver={(event) => {
            if (busy) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border border-dashed px-4 py-6 text-center transition-colors outline-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-foreground/8 disabled:cursor-not-allowed disabled:opacity-60",
            dragging
              ? "border-foreground bg-accent/70 text-foreground"
              : "border-input bg-background/60 text-muted-foreground hover:border-foreground/50 hover:bg-accent/40 hover:text-foreground",
          )}
        >
          {uploading ? (
            <>
              <LoaderCircle
                size={20}
                aria-hidden="true"
                className="text-foreground motion-safe:animate-spin"
              />
              <span className="text-xs font-medium text-foreground">
                正在上传封面图片…
              </span>
            </>
          ) : (
            <>
              <span className="grid size-9 place-items-center rounded-control border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
                <ImagePlus size={17} aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-foreground">
                点击选择或拖拽图片到此处上传
              </span>
              <span className="text-[11px] text-muted-foreground">
                PNG / JPEG / WebP / GIF / AVIF · 最大 5 MB
              </span>
            </>
          )}
        </button>
      )}

      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          placeholder={placeholder}
          value={value}
          maxLength={2048}
          disabled={busy}
          aria-invalid={!!(error || uploadError)}
          onChange={(event) => {
            setFailedUrl(null);
            setUploadError(null);
            onChange(event.currentTarget.value);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={openPicker}
          aria-label={`上传${label}`}
        >
          <Upload size={14} aria-hidden="true" />
          <span className="hidden sm:inline">上传</span>
        </Button>
      </div>

      {uploadError && (
        <p role="alert" className="text-xs text-destructive">
          {uploadError}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
