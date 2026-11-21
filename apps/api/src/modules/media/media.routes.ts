import { Elysia, status, t } from "elysia";
import { adminSecurity } from "../../plugins/admin-security";
import { authError, errorResponse } from "../auth/auth.schema";

export const COVER_MAX_BYTES = 5 * 1024 * 1024;

const UUID_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif|avif)$/;

const extToMime: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

type DetectedFormat = {
  contentType: string;
  ext: "png" | "jpg" | "webp" | "gif" | "avif";
};

function matchesAscii(bytes: Uint8Array, offset: number, text: string) {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

export function detectImageFormat(bytes: Uint8Array): DetectedFormat | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", ext: "png" };
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 6 &&
    (matchesAscii(bytes, 0, "GIF87a") || matchesAscii(bytes, 0, "GIF89a"))
  ) {
    return { contentType: "image/gif", ext: "gif" };
  }
  if (
    bytes.length >= 12 &&
    matchesAscii(bytes, 0, "RIFF") &&
    matchesAscii(bytes, 8, "WEBP")
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  if (
    bytes.length >= 12 &&
    matchesAscii(bytes, 4, "ftyp") &&
    (matchesAscii(bytes, 8, "avif") || matchesAscii(bytes, 8, "avis"))
  ) {
    return { contentType: "image/avif", ext: "avif" };
  }
  return null;
}

function resolvePublicUrl(
  requestUrl: string,
  baseUrl: string | undefined,
  key: string,
  filename: string,
) {
  const trimmed = baseUrl?.trim();
  if (trimmed) {
    const parsed = URL.parse(trimmed);
    if (
      parsed &&
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.username &&
      !parsed.password &&
      !parsed.search &&
      !parsed.hash
    ) {
      return `${parsed.href.replace(/\/$/, "")}/${key}`;
    }
  }
  return `${new URL(requestUrl).origin}/api/public/media/covers/${filename}`;
}

export const coverUploadResponse = t.Object({
  url: t.String(),
  key: t.String(),
  contentType: t.String(),
  size: t.Integer(),
});

export function mediaRoutes(getEnv: () => Cloudflare.Env) {
  return new Elysia({ prefix: "/api/admin/media" })
    .use(adminSecurity(getEnv))
    .post(
      "/covers",
      async ({ request, identity }) => {
        const env = getEnv();
        if (!env.MEDIA) {
          return status(
            503,
            authError(
              "MEDIA_UNAVAILABLE",
              "Media storage is not configured.",
            ),
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return status(
            400,
            authError("INVALID_REQUEST", "Invalid multipart form data."),
          );
        }

        const entry = form.get("file");
        if (
          !entry ||
          typeof entry === "string" ||
          typeof entry.arrayBuffer !== "function"
        ) {
          return status(
            400,
            authError("INVALID_IMAGE", "Please attach an image file."),
          );
        }
        if (entry.size > COVER_MAX_BYTES) {
          return status(
            413,
            authError(
              "FILE_TOO_LARGE",
              "Cover image must be 5 MB or smaller.",
            ),
          );
        }

        const bytes = new Uint8Array(await entry.arrayBuffer());
        if (bytes.byteLength === 0) {
          return status(
            400,
            authError("INVALID_IMAGE", "Uploaded image file is empty."),
          );
        }
        if (bytes.byteLength > COVER_MAX_BYTES) {
          return status(
            413,
            authError(
              "FILE_TOO_LARGE",
              "Cover image must be 5 MB or smaller.",
            ),
          );
        }

        const format = detectImageFormat(bytes);
        if (!format) {
          return status(
            400,
            authError(
              "INVALID_IMAGE",
              "Only PNG, JPEG, WebP, GIF, and AVIF images are supported.",
            ),
          );
        }

        const filename = `${crypto.randomUUID()}.${format.ext}`;
        const key = `covers/${filename}`;
        await env.MEDIA.put(key, bytes, {
          httpMetadata: { contentType: format.contentType },
          customMetadata: { uploadedBy: identity.username },
        });

        return status(201, {
          url: resolvePublicUrl(
            request.url,
            env.MEDIA_PUBLIC_BASE_URL,
            key,
            filename,
          ),
          key,
          contentType: format.contentType,
          size: bytes.byteLength,
        });
      },
      {
        requireSession: true,
        parse: "none",
        response: {
          201: coverUploadResponse,
          400: errorResponse,
          401: errorResponse,
          403: errorResponse,
          413: errorResponse,
          500: errorResponse,
          503: errorResponse,
        },
      },
    );
}

export function publicMediaRoutes(getEnv: () => Cloudflare.Env) {
  return new Elysia({ prefix: "/api/public/media" }).get(
    "/covers/:file",
    async ({ params }) => {
      const match = UUID_FILE_PATTERN.exec(params.file);
      if (!match) {
        return status(404, authError("MEDIA_NOT_FOUND", "Image not found."));
      }
      const env = getEnv();
      if (!env.MEDIA) {
        return status(
          503,
          authError("MEDIA_UNAVAILABLE", "Media storage is not configured."),
        );
      }

      const object = await env.MEDIA.get(`covers/${params.file}`);
      if (!object) {
        return status(404, authError("MEDIA_NOT_FOUND", "Image not found."));
      }

      const headers = new Headers();
      headers.set(
        "Content-Type",
        object.httpMetadata?.contentType ??
          extToMime[match[1]] ??
          "application/octet-stream",
      );
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      if (object.httpEtag) {
        headers.set("ETag", object.httpEtag);
      }

      return new Response(object.body, { status: 200, headers });
    },
  );
}
