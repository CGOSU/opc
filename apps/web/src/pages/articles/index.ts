import type { APIRoute } from "astro";
import { articlesPath } from "../../lib/articles";

export const prerender = false;
export const GET: APIRoute = () =>
  new Response(null, {
    status: 308,
    headers: { Location: articlesPath("zh"), "Cache-Control": "no-store" },
  });
