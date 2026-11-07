/** Return the first supported browser preference, defaulting to Chinese. */
export function resolveBrowserLocale(languages) {
  if (!Array.isArray(languages)) return "zh";
  for (const language of languages) {
    if (typeof language !== "string") continue;
    const primary = language.trim().toLowerCase().split("-")[0];
    if (primary === "zh" || primary === "en") return primary;
  }
  return "zh";
}
