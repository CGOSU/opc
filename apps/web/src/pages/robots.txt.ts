import type { APIRoute } from "astro";

// Let crawlers reach pages carrying noindex, including previews and search.
export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *\nAllow: /\n${site ? `Sitemap: ${new URL("/sitemap.xml", site).href}\n` : ""}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
