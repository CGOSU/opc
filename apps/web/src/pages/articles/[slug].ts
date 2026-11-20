import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { articleUnavailable, findArticle } from "../../lib/articles";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!env.CONTENT) return articleUnavailable();
  try {
    const article = await findArticle(env.CONTENT, "zh", params.slug);
    const headers = { "Cache-Control": "no-store" };
    if (!article) return new Response("Not found", { status: 404, headers });
    return new Response(null, {
      status: 308,
      headers: { ...headers, Location: article.path },
    });
  } catch {
    return articleUnavailable();
  }
};
