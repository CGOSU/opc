import MarkdownIt from "markdown-it";
import highlighter from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

for (const [name, grammar] of Object.entries({
  bash,
  css,
  javascript,
  json,
  sql,
  typescript,
  xml,
})) {
  highlighter.registerLanguage(name, grammar);
}

export type ArticleHeading = { id: string; label: string; level: number };

const md = new MarkdownIt({
  html: false,
  linkify: false,
  highlight(code, language) {
    if (code.length > 30_000 || !highlighter.getLanguage(language)) return "";
    return highlighter.highlight(code, { language, ignoreIllegals: true })
      .value;
  },
});

md.validateLink = (url) => {
  if (/^(?:\/\/|\\)|[\\\u0000-\u001f\u007f]/u.test(url)) return false;
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(url)?.[0].toLowerCase();
  return (
    !scheme || scheme === "http:" || scheme === "https:" || scheme === "mailto:"
  );
};

const renderImage = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet("loading", "lazy");
  tokens[index].attrSet("decoding", "async");
  return renderImage(tokens, index, options, env, renderer);
};

export function renderArticleMarkdown(source: string) {
  const env = {};
  const tokens = md.parse(source, env);
  const headings: ArticleHeading[] = [];
  const usedIds = new Set<string>();
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;
    const level = Math.max(2, Number(token.tag.slice(1)));
    const inline = tokens[index + 1];
    const label = (inline.children ?? [])
      .map((part) =>
        ["text", "code_inline", "image"].includes(part.type)
          ? part.content
          : "",
      )
      .join("")
      .trim();
    const base =
      "section-" +
      (label
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "heading");
    let id = base;
    for (let i = 2; usedIds.has(id); i++) id = `${base}-${i}`;
    usedIds.add(id);
    token.attrSet("id", id);
    token.tag = tokens[index + 2].tag = `h${level}`;
    if (label) headings.push({ id, label, level });
  }
  return { html: md.renderer.render(tokens, md.options, env), headings };
}
