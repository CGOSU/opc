import { DatabaseSync } from 'node:sqlite';
import { z } from 'astro/zod';

const string = z.string().min(1);
const homeSchema = z.object({
  name: string, title: string, description: string, eyebrow: string,
  headline: z.tuple([string, string]), intro: string, nav: z.tuple([string, string, string, string]),
  contact: string, read: string, work: string, notes: string, notesIntro: string,
  noteLabel: string, sample: string, preview: string,
  articles: z.array(z.object({ category: string, title: string, summary: string, detail: string, kind: z.literal('feature').optional() })).min(1),
  projectsTitle: string, projectsIntro: string, projectLabel: string, concept: string,
  projects: z.array(z.object({title: string, summary: string, tags: string, visual: z.enum(['web', 'film'])})),
  servicesTitle: string, serviceLabel: string, services: z.array(z.object({title: string, text: string})),
  aboutLabel: string, aboutTitle: string, aboutText: string, contactTitle: string, contactText: string,
  contactEmpty: string, contactNote: string, footer: string, notice: string, illustration: string,
  skip: string, menu: string, close: string, footerNav: string, lang: string, back: string,
});
export type HomeContent = z.infer<typeof homeSchema>;
export type Locale = 'zh' | 'en';
const menuSchema = z.array(z.object({label: string, base_href: z.string().regex(/^\/(zh|en)\/$/), fragment: z.enum(['notes', 'work', 'services', 'about'])})).length(4);
export type MenuItem = {label: string; href: string};

export function getHome(locale: Locale) {
  const path = process.env.CONTENT_DB;
  if (!path) throw new Error('CONTENT_DB must be configured before reading published content.');
  const db = new DatabaseSync(path, {readOnly: true});
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const row = db.prepare("SELECT blocks_json, noindex FROM published_content WHERE locale = ? AND route_path = '/' AND template_key = 'home'").get(locale);
    if (!row) throw new Error('No published homepage for ' + locale);
    const parsed = z.array(homeSchema).length(1).safeParse(JSON.parse(String(row.blocks_json)));
    if (!parsed.success) throw new Error('Invalid homepage snapshot: ' + parsed.error.message);
    const site = db.prepare('SELECT site_name FROM published_site WHERE locale = ?').get(locale);
    if (!site) throw new Error('No published site configuration for ' + locale);
    const readMenu = (slot: string): MenuItem[] => {
      const result = menuSchema.safeParse(db.prepare('SELECT label, base_href, fragment FROM published_navigation WHERE locale = ? AND slot = ? ORDER BY position').all(locale, slot));
      if (!result.success) throw new Error('Invalid published homepage navigation: ' + result.error.message);
      return result.data.map(item => ({label: item.label, href: item.base_href + '#' + item.fragment}));
    };
    return { content: {...parsed.data[0], name: String(site.site_name)}, noindex: row.noindex === 1, headerMenu: readMenu('header_primary'), footerMenu: readMenu('footer_main') };
  } finally { db.close(); }
}
