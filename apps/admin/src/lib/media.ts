export const COVER_MAX_BYTES = 5 * 1024 * 1024;

export const COVER_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/avif";

const allowedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const allowedExtPattern = /\.(png|jpe?g|webp|gif|avif)$/i;

export type CoverUploadResult = {
  url: string;
  key: string;
  contentType: string;
  size: number;
};

export function validateCoverFile(file: File): string | null {
  if (file.size === 0) {
    return "不能上传空文件，请选择有效的图片。";
  }
  if (file.size > COVER_MAX_BYTES) {
    return "图片大小不能超过 5 MB。";
  }
  const type = file.type.trim().toLowerCase();
  if (type) {
    if (!allowedTypes.has(type)) {
      return "仅支持 PNG、JPEG、WebP、GIF 或 AVIF 格式图片。";
    }
    return null;
  }
  if (!allowedExtPattern.test(file.name)) {
    return "仅支持 PNG、JPEG、WebP、GIF 或 AVIF 格式图片。";
  }
  return null;
}

export async function uploadCoverImage(file: File): Promise<CoverUploadResult> {
  const form = new FormData();
  form.set("file", file);

  let response: Response;
  try {
    response = await fetch("/api/admin/media/covers", {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-OPC-CSRF": "1" },
      body: form,
    });
  } catch {
    throw new Error("网络异常，暂时无法上传封面图。");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    const code = payload?.error?.code;

    if (response.status === 401) {
      throw new Error("登录状态已过期，请刷新并重新登录后上传。");
    }
    if (response.status === 403) {
      throw new Error("上传请求被同源安全策略拒绝，请刷新页面后重试。");
    }
    if (response.status === 413 || code === "FILE_TOO_LARGE") {
      throw new Error("图片大小不能超过 5 MB。");
    }
    if (response.status === 400) {
      throw new Error(
        code === "INVALID_IMAGE"
          ? "图片格式不受支持或文件内容损坏，请上传 PNG、JPEG、WebP、GIF 或 AVIF 图片。"
          : "上传请求无效，请重试。",
      );
    }
    if (response.status === 503) {
      throw new Error("媒体存储服务尚未配置或暂不可用。");
    }
    throw new Error("上传封面图失败，请稍后重试。");
  }

  return (await response.json()) as CoverUploadResult;
}
