import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { articleUnavailable } from "../lib/articles";
import { discoveryUnavailableInPreview, sitemap } from "../lib/discovery";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  if (!site) return discoveryUnavailableInPreview();
  if (!env.CONTENT) return articleUnavailable();
  try {
    return await sitemap(env.CONTENT, site);
  } catch {
    return articleUnavailable();
  }
};
