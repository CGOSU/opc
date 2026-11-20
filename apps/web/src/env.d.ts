declare module "cloudflare:workers" {
  export const env: {
    CONTENT?: import("@cloudflare/workers-types/index.ts").D1Database;
    CONTENT_ASSET_BASE_URL?: string;
  };
}
