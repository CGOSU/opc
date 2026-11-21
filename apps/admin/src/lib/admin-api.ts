import { treaty } from "@elysiajs/eden";
import type { App } from "@opc/api";

export const adminApi = treaty<App>(window.location.origin, {
  fetch: { credentials: "same-origin" },
}).api.admin;

export const writeOptions = { headers: { "X-OPC-CSRF": "1" } };

export const publicSiteOrigin =
  import.meta.env.VITE_PUBLIC_SITE_ORIGIN || "http://localhost:4321";
