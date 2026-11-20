import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { articleUnavailable } from "../../lib/articles";
import { listTopics, topicsPath } from "../../lib/topics";

export const prerender = false;

export const GET: APIRoute = async () => {
  if (!env.CONTENT) return articleUnavailable();
  try {
    const results = await listTopics(env.CONTENT, "zh", 1);
    return results.length
      ? new Response(null, {
          status: 308,
          headers: { Location: topicsPath("zh"), "Cache-Control": "no-store" },
        })
      : new Response("Not found", {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
  } catch {
    return articleUnavailable();
  }
};
