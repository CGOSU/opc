import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Both default and relative CONTENT_DB paths are rooted at the repository.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
if (process.env.CONTENT_DB !== undefined && !process.env.CONTENT_DB.trim()) {
  throw new Error("CONTENT_DB must not be empty.");
}
process.env.CONTENT_DB = resolve(
  repositoryRoot,
  process.env.CONTENT_DB ?? "data/content.sqlite",
);
const configuredSite = process.env.SITE_URL?.trim();
const site = configuredSite ? new URL(configuredSite) : undefined;
if (
  site &&
  (!["http:", "https:"].includes(site.protocol) ||
    site.username ||
    site.password ||
    site.pathname !== "/" ||
    site.search ||
    site.hash)
) {
  throw new Error(
    "SITE_URL must be an HTTP(S) origin without a path or credentials.",
  );
}

export default defineConfig({
  output: "static",
  adapter: cloudflare({
    prerenderEnvironment: "node",
    remoteBindings: false,
    imageService: "passthrough",
  }),
  session: false,
  site: site?.origin,
  trailingSlash: "always",
});
