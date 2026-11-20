import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { articleLocale, articleUnavailable } from "../../lib/articles";
import {
  articleFeed,
  discoveryUnavailableInPreview,
} from "../../lib/discovery";

export const prerender = false;

export const GET: APIRoute = async ({ params, site }) => {
  const locale = articleLocale(params.locale);
  if (!locale || !site) return discoveryUnavailableInPreview();
  if (!env.CONTENT) return articleUnavailable();
  try {
    return await articleFeed(env.CONTENT, site, locale);
  } catch {
    return articleUnavailable();
  }
};
