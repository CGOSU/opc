# OPC Admin design

## Sign-in surface

Use the shared neutral palette and sans-serif stack, with no illustration or entrance motion. The product name anchors the header; the centered, 384px-wide form is the only primary task. Keep inputs, error message, and primary button in reading and tab order. On narrow screens the form keeps its hierarchy with smaller outer spacing, not smaller controls.

Use a 4px spacing grid, 56px header, 24px page title, 14px body, 36px controls, 8px control radius, and 150ms transitions. Define the palette and dimensions in `src/index.css` for reuse as the admin UI grows. Error state uses text and an alert role, not color alone.

## Admin shell

Source: Doop canvas `EFayn0CJaf`, 管理原型 and its responsive/state studies. Use the shared neutral zinc palette, the Inter/system sans-serif stack, and the grouped 248px sidebar. The sidebar collapses to 64px without hiding accessible link names; below 768px navigation uses a labeled modal drawer with Escape and focus return. The 56px header separates breadcrumbs from the account menu. Main content uses 24px horizontal padding on larger screens and 16px on narrow screens.

The article list uses 72px rows and a footer containing pagination. When space narrows, hide the tags column first; below 1024px, keep the title, update time, and actions, and put filters in an expandable panel. Keep the current API's per-language rows, totals, and language selector. The version badges reflect actual linked translations; they do not imply support for filtering by translation completeness. Confirm permanent actions in a focused alert dialog; use inline errors for recoverable failures.

## Article editor

Source: Doop 管理原型 / 文章管理 · 编辑. Put the active translation in the main column and shared settings in a separate side panel. Stack the panels on narrower screens without changing their save boundaries. Keep optional SEO collapsed by default and omit the prototype's simulated sync and conflict controls. The language switch opens an existing version or starts an explicit new one; leaving with unsaved work requires confirmation. A genuine revision conflict keeps the draft in place until the editor chooses to discard it and reload the server version.

## Categories and tags

Source: the Doop bilingual category and tag frames. Show one row per shared entity, with real language-version badges, counts, and a language-state filter. Editing opens a right-hand panel (full-width at narrow sizes). Switch between language forms without losing their local drafts; save language fields and shared sorting separately. Label untranslated historical values as such and never prefill a missing version with them.

## Topics

Source: the Doop topic list and editor frames. Show one row per topic, with language availability, article count, and sort and language filters. In the editor, keep each language form mounted while switching, collapse SEO by default, and separate language publishing, shared cover/display order, and ordered membership. Provide drag handles and explicit move buttons; show how many saved members have a public version in the selected language. Keep any legacy text visible as historical context, not as a translation. Do not show the mock sync indicator: saving writes to D1, and the public Worker reads D1.
