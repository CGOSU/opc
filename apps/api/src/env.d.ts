declare namespace Cloudflare {
  interface Env {
    CONTENT: D1Database;
    ADMIN_ORIGIN?: string;
    MEDIA?: R2Bucket;
    MEDIA_PUBLIC_BASE_URL?: string;
  }
}
