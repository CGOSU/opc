import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { articleUnavailable } from "../../lib/articles";
import { findTopic } from "../../lib/topics";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  if (!env.CONTENT) return articleUnavailable();
  try {
    const topic = await findTopic(env.CONTENT, "zh", params.slug);
    return topic
      ? new Response(null, {
          status: 308,
          headers: { Location: topic.path, "Cache-Control": "no-store" },
        })
      : new Response("Not found", {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
  } catch {
    return articleUnavailable();
  }
};
