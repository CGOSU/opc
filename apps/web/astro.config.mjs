import { defineConfig } from "astro/config";
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
export default defineConfig({
  output: "static",
  site: process.env.SITE_URL,
  trailingSlash: "always",
});
