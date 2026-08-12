# Content → Markdown Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the editable wiki pages (game/maps/guides) from HTML blobs in `src/data/pages.json` into per-page Markdown files rendered by an Astro content collection, with the live site visually unchanged — so content becomes hand-editable while nothing on the public site changes.

**Architecture:** Introduce an Astro content collection (`wiki`) of per-page `.md` files (frontmatter + body). A cheerio-based converter turns each editable page's cleaned HTML into Markdown, converting prose/headings/lists/links/emphasis to Markdown and preserving complex structures (wikitables, figures, references, math, hatnotes) as raw HTML in the body. Explicit heading ids are kept via a remark plugin so anchors and the table of contents keep working. The `[slug].astro` route sources editable pages from the collection and leaves the OpenFront Masters pages on `pages.json` (still a Liquipedia mirror).

**Tech Stack:** Astro 5.6 (content collections, `glob` loader from `astro/loaders`), `remark-custom-heading-id` (explicit `{#id}` heading syntax), `cheerio` (already a dependency), `node --test` (existing test runner, `.test.mjs` files), Pagefind (build step, unchanged).

## Global Constraints

- Node run via `corepack pnpm <script>` with `C:\Program Files\nodejs` on PATH; the repo canonical path is `C:\Users\lewis\dev\openfront-wiki` (never work under OneDrive).
- The public site must stay visually identical after cutover: same layout, styling, sidebar, TOC, search. Any parity gap is a task failure.
- Editable scope = pages where `section !== undefined` AND `source !== "liquipedia"` (the game/maps/guides pages). Masters pages (`source === "liquipedia"`) stay in `pages.json` and are NOT migrated.
- Preserve exact heading `id`s from the source HTML (e.g. `See_also`, `Nations`) — the TOC and in-page/cross-page `#anchor` links depend on them.
- Complex HTML (`table`, `figure`, `sup` references, `ol.references`, `pre`, math spans, `.hatnote`) is preserved verbatim as raw HTML in the Markdown body, not converted.
- Tests use Node's built-in runner: files named `*.test.mjs`, run with `node --test`.
- Frequent commits: one per task. Commit messages end with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer. Do NOT push during implementation (the repo auto-deploys on push); the human pushes after review.

---

### Task 1: Content collection + Markdown pipeline (explicit heading ids)

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json` (add `remark-custom-heading-id` dependency)
- Create: `src/content.config.ts`
- Create: `src/content/wiki/_pipeline_check.md` (temporary sample, deleted in Task 6)

**Interfaces:**
- Produces: a `wiki` content collection whose entries have `data: { title: string; section: string; cats: string[]; source?: string; sourceUrl?: string; stub?: boolean }` and a Markdown body. Heading syntax `## Text {#Explicit_Id}` yields `<h2 id="Explicit_Id">Text</h2>` and appears in `render().headings` with `slug === "Explicit_Id"`.

- [ ] **Step 1: Install the explicit-heading-id remark plugin**

Run:
```bash
corepack pnpm add remark-custom-heading-id
```
Expected: `remark-custom-heading-id` added to `package.json` dependencies.

- [ ] **Step 2: Wire the plugin into Astro's markdown config**

Edit `astro.config.mjs` to:
```js
// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { remarkCustomHeadingId } from "remark-custom-heading-id";

// https://astro.build/config
export default defineConfig({
  site: "https://openfront.wiki",
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkCustomHeadingId],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Define the `wiki` content collection**

Create `src/content.config.ts`:
```ts
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const wiki = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/wiki" }),
  schema: z.object({
    title: z.string(),
    section: z.string(),
    cats: z.array(z.string()).default([]),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
    stub: z.boolean().optional(),
  }),
});

export const collections = { wiki };
```

- [ ] **Step 4: Add a sample page that exercises the pipeline**

Create `src/content/wiki/_pipeline_check.md`:
```markdown
---
title: Pipeline Check
section: Meta & community
cats: []
---

Intro paragraph with **bold**, _italic_, and a [link to Nations](/Nations).

## First section {#First_section}

- item one
- item two

## See also {#See_also}

<table class="wikitable"><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>
```

- [ ] **Step 5: Verify the collection builds and heading ids are explicit**

Create a throwaway check by building the site (the real assertion happens in Task 2's route, but confirm the collection compiles):
```bash
corepack pnpm astro sync
```
Expected: completes with no schema error and generates `.astro/` types for the `wiki` collection.

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs package.json pnpm-lock.yaml src/content.config.ts src/content/wiki/_pipeline_check.md
git commit -m "$(printf 'Add wiki content collection + explicit-heading-id markdown\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Parallel render route with visual parity

Renders collection entries through the SAME layout/styling as the live pages, at a temporary `/wiki-preview/<slug>` route, so parity can be checked before cutover. Deleted in Task 6.

**Files:**
- Create: `src/pages/wiki-preview/[slug].astro`

**Interfaces:**
- Consumes: the `wiki` collection (Task 1). Uses `getCollection("wiki")`, `render(entry)` → `{ Content, headings }`.
- Produces: nothing later tasks import; it is a verification surface removed in Task 6.

- [ ] **Step 1: Write the preview route reusing the existing layout + TOC**

Create `src/pages/wiki-preview/[slug].astro`:
```astro
---
import { getCollection, render } from "astro:content";
import Layout from "../../layouts/Layout.astro";
import SiteHeader from "../../components/SiteHeader.astro";
import SiteFooter from "../../components/SiteFooter.astro";
import BrowseSidebar from "../../components/BrowseSidebar.astro";

export async function getStaticPaths() {
  const entries = await getCollection("wiki");
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

const { entry } = Astro.props;
const { Content, headings } = await render(entry);
const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
---

<Layout title={`${entry.data.title} — OpenFront Wiki`}>
  <SiteHeader />
  <div class="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
    <aside class="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto" data-pagefind-ignore>
      <BrowseSidebar currentSlug={entry.id} />
    </aside>
    <main class="min-w-0">
      <h1 class="font-display text-3xl font-bold tracking-wide text-white sm:text-4xl">{entry.data.title}</h1>
      <div class="mt-5 h-px w-full bg-gradient-to-r from-malibu/50 via-white/10 to-transparent"></div>
      <article class="wiki-content mt-6"><Content /></article>
    </main>
    {toc.length > 1 && (
      <aside class="hidden xl:block" data-pagefind-ignore>
        <div class="sticky top-20">
          <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-glow">On this page</p>
          <ul class="space-y-1.5 border-l border-white/10 text-sm">
            {toc.map((h) => (
              <li>
                <a href={`#${h.slug}`} class:list={["-ml-px block border-l-2 border-transparent py-0.5 text-dawn/70 transition-colors hover:border-malibu hover:text-white", h.depth === 3 ? "pl-6" : "pl-3"]}>{h.text}</a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    )}
  </div>
  <SiteFooter />
</Layout>
```

- [ ] **Step 2: Build and confirm the sample renders with correct structure**

Run:
```bash
corepack pnpm build
```
Then assert the sample's heading id and table survived:
```bash
node -e 'const h=require("fs").readFileSync("dist/wiki-preview/_pipeline_check/index.html","utf8"); console.log("h2 id kept:", h.includes("id=\"See_also\"")); console.log("wikitable kept:", h.includes("class=\"wikitable\"")); console.log("TOC anchor:", h.includes("href=\"#See_also\""));'
```
Expected: all three print `true`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/wiki-preview/[slug].astro
git commit -m "$(printf 'Add parallel wiki-preview route for parity checks\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: HTML → Markdown converter (cheerio, test-first)

The core of Phase 1. A pure function converting one page's cleaned HTML into Markdown: prose/headings/lists/links/emphasis → Markdown; everything else → raw HTML preserved verbatim.

**Files:**
- Create: `scripts/lib/html-to-markdown.mjs`
- Test: `scripts/lib/html-to-markdown.test.mjs`

**Interfaces:**
- Produces: `export function htmlToMarkdown(html: string): string`. Headings become `## Text {#Id}`; `<a href>` become `[text](href)`; `<b>/<strong>` → `**x**`; `<i>/<em>` → `_x_`; `<ul>/<ol>/<li>` → Markdown lists; `<p>` → text blocks. `<table>`, `<figure>`, `<sup class="reference">`, `<ol class="references">`, `<pre>`, `.hatnote`, math spans are emitted as raw HTML unchanged.

- [ ] **Step 1: Write failing tests for the block conversions**

Create `scripts/lib/html-to-markdown.test.mjs`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown } from "./html-to-markdown.mjs";

test("mw-heading becomes markdown heading with explicit id", () => {
  const md = htmlToMarkdown('<div class="mw-heading mw-heading2"><h2 id="See_also">See also</h2></div>');
  assert.equal(md.trim(), "## See also {#See_also}");
});

test("paragraph with bold, italic and internal link", () => {
  const md = htmlToMarkdown('<p>Use a <b>Warship</b> to <i>capture</i> a <a href="/Trade_Ship" title="Trade Ship">trade ship</a>.</p>');
  assert.equal(md.trim(), "Use a **Warship** to _capture_ a [trade ship](/Trade_Ship).");
});

test("unordered list", () => {
  const md = htmlToMarkdown("<ul><li>one</li><li>two</li></ul>");
  assert.equal(md.trim(), "- one\n- two");
});

test("wikitable is preserved as raw html", () => {
  const html = '<table class="wikitable"><tbody><tr><th>A</th></tr></tbody></table>';
  assert.ok(htmlToMarkdown(html).includes('<table class="wikitable">'));
});

test("figure is preserved as raw html", () => {
  const html = '<figure class="mw-default-size"><img src="/images/x.webp"><figcaption>cap</figcaption></figure>';
  const md = htmlToMarkdown(html);
  assert.ok(md.includes("<figure") && md.includes("<figcaption>cap</figcaption>"));
});

test("reference sup and references list preserved as raw html", () => {
  const html = '<p>fact<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup></p><div class="mw-references-wrap"><ol class="references"><li id="cite_note-1">src</li></ol></div>';
  const md = htmlToMarkdown(html);
  assert.ok(md.includes('class="reference"') && md.includes('class="references"'));
});

test("external links get plain markdown link", () => {
  const md = htmlToMarkdown('<p><a href="https://github.com/openfrontio" target="_blank" rel="noopener noreferrer">GitHub</a></p>');
  assert.equal(md.trim(), "[GitHub](https://github.com/openfrontio)");
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run:
```bash
node --test scripts/lib/html-to-markdown.test.mjs
```
Expected: FAIL — `Cannot find module './html-to-markdown.mjs'`.

- [ ] **Step 3: Implement the converter**

Create `scripts/lib/html-to-markdown.mjs`:
```js
import * as cheerio from "cheerio";

// Tags/selectors whose subtree is emitted verbatim as raw HTML (fidelity kept).
const RAW = "table, figure, pre, .hatnote, .mw-references-wrap, .gallery, .mwe-math-element, .mwe-math-mathml-inline, .mwe-math-mathml-display";

function inline($, el) {
  const $el = $(el);
  return $el
    .contents()
    .toArray()
    .map((n) => {
      if (n.type === "text") return n.data;
      const $n = $(n);
      const tag = n.tagName;
      if (tag === "b" || tag === "strong") return `**${inline($, n).trim()}**`;
      if (tag === "i" || tag === "em") return `_${inline($, n).trim()}_`;
      if (tag === "code") return `\`${$n.text()}\``;
      if (tag === "a") {
        const href = $n.attr("href") || "";
        return `[${inline($, n).trim()}](${href})`;
      }
      if (tag === "sup" && $n.hasClass("reference")) return $.html(n); // keep refs raw
      if (tag === "br") return "\n";
      return inline($, n);
    })
    .join("");
}

function listMarkdown($, el, ordered, depth = 0) {
  const pad = "  ".repeat(depth);
  return $(el)
    .children("li")
    .toArray()
    .map((li, i) => {
      const marker = ordered ? `${i + 1}.` : "-";
      const nested = $(li).children("ul, ol").toArray();
      const text = inline($, li).trim().split("\n")[0];
      let out = `${pad}${marker} ${text}`;
      for (const n of nested) out += "\n" + listMarkdown($, n, n.tagName === "ol", depth + 1);
      return out;
    })
    .join("\n");
}

export function htmlToMarkdown(html) {
  const $ = cheerio.load(html, null, false);
  const blocks = [];
  // process only top-level nodes; unwrap mw-heading wrappers first
  $("div.mw-heading").each((_, el) => $(el).replaceWith($(el).contents()));
  $.root()
    .contents()
    .toArray()
    .forEach((node) => {
      if (node.type === "comment") return;
      if (node.type === "text") {
        if (node.data.trim()) blocks.push(node.data.trim());
        return;
      }
      const $node = $(node);
      const tag = node.tagName;
      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag[1]);
        const id = $node.attr("id");
        const text = inline($, node).trim();
        blocks.push(`${"#".repeat(level)} ${text}${id ? ` {#${id}}` : ""}`);
        return;
      }
      if (tag === "p") {
        const text = inline($, node).trim();
        if (text) blocks.push(text);
        return;
      }
      if (tag === "ul" || tag === "ol") {
        blocks.push(listMarkdown($, node, tag === "ol"));
        return;
      }
      if ($node.is(RAW)) {
        blocks.push($.html(node).trim());
        return;
      }
      // fallback: keep unknown block as raw html so nothing is lost
      blocks.push($.html(node).trim());
    });
  return blocks.join("\n\n") + "\n";
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run:
```bash
node --test scripts/lib/html-to-markdown.test.mjs
```
Expected: all 7 tests PASS. If a real page later exposes a construct these tests miss, add a test for it and extend the converter (the raw-HTML fallback guarantees nothing is silently lost).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/html-to-markdown.mjs scripts/lib/html-to-markdown.test.mjs
git commit -m "$(printf 'Add tested HTML-to-Markdown converter (prose to md, complex stays html)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: Migration script — write per-page Markdown files

**Files:**
- Create: `scripts/migrate-to-markdown.mjs`

**Interfaces:**
- Consumes: `htmlToMarkdown` (Task 3), `src/data/pages.json`.
- Produces: one `src/content/wiki/<slug>.md` per editable page, with YAML frontmatter (`title`, `section`, `cats`, `source`/`sourceUrl`/`stub` when present) followed by the converted body.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-to-markdown.mjs`:
```js
import fs from "fs";
import path from "path";
import { htmlToMarkdown } from "./lib/html-to-markdown.mjs";

const OUT = path.resolve("src/content/wiki");
fs.mkdirSync(OUT, { recursive: true });
const pages = JSON.parse(fs.readFileSync("src/data/pages.json", "utf8"));

// editable = has a browse section AND is not the Liquipedia mirror
const editable = pages.filter((p) => p.section && p.source !== "liquipedia");

const yamlStr = (s) => JSON.stringify(String(s)); // safe-quote for YAML
let n = 0;
for (const p of editable) {
  const fm = [
    "---",
    `title: ${yamlStr(p.title)}`,
    `section: ${yamlStr(p.section)}`,
    `cats: ${JSON.stringify(p.cats || [])}`,
    p.stub ? "stub: true" : "",
    "---",
    "",
  ].filter(Boolean).join("\n");
  const body = htmlToMarkdown(p.html);
  fs.writeFileSync(path.join(OUT, `${p.slug}.md`), fm + "\n" + body);
  n++;
}
console.log(`wrote ${n} markdown pages to src/content/wiki`);
```

- [ ] **Step 2: Run the migration**

Run:
```bash
node scripts/migrate-to-markdown.mjs
```
Expected: prints `wrote <N> markdown pages` where N equals the editable page count. Verify:
```bash
node -e 'const p=require("./src/data/pages.json"); const e=p.filter(x=>x.section&&x.source!=="liquipedia").length; const f=require("fs").readdirSync("src/content/wiki").filter(x=>x.endsWith(".md")&&x!=="_pipeline_check.md").length; console.log("editable:",e,"files:",f,"match:",e===f);'
```
Expected: `match: true`.

- [ ] **Step 3: Build to confirm every migrated file satisfies the schema and compiles**

Run:
```bash
corepack pnpm build
```
Expected: build completes; `dist/wiki-preview/<slug>/index.html` exists for the migrated slugs. If the build fails on a specific file (e.g. a frontmatter or unclosed-HTML issue), fix the converter/migration, re-run, and re-build.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-markdown.mjs src/content/wiki
git commit -m "$(printf 'Migrate editable wiki pages to Markdown content collection\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: Parity verification (preview vs live)

Confirm the Markdown-rendered pages match the current `pages.json`-rendered pages before cutover.

**Files:**
- Create: `scripts/check-parity.mjs`

**Interfaces:**
- Consumes: built `dist/<slug>/index.html` (live) and `dist/wiki-preview/<slug>/index.html` (preview).
- Produces: a report of per-page differences in visible text, heading ids, and table/figure counts.

- [ ] **Step 1: Write the parity checker**

Create `scripts/check-parity.mjs`:
```js
import fs from "fs";
import * as cheerio from "cheerio";

const pages = JSON.parse(fs.readFileSync("src/data/pages.json", "utf8"));
const editable = pages.filter((p) => p.section && p.source !== "liquipedia");

const norm = (s) => s.replace(/\s+/g, " ").trim();
function facts(file) {
  if (!fs.existsSync(file)) return null;
  const $ = cheerio.load(fs.readFileSync(file, "utf8"));
  const art = $("article.wiki-content");
  return {
    text: norm(art.text()),
    ids: art.find("h1,h2,h3,h4").map((_, e) => $(e).attr("id")).get().filter(Boolean).sort(),
    tables: art.find("table").length,
    figures: art.find("figure").length,
  };
}
let bad = 0;
for (const p of editable) {
  const live = facts(`dist/${p.slug}/index.html`);
  const prev = facts(`dist/wiki-preview/${p.slug}/index.html`);
  if (!live || !prev) { console.log("MISSING", p.slug); bad++; continue; }
  const idsEq = JSON.stringify(live.ids) === JSON.stringify(prev.ids);
  const tblEq = live.tables === prev.tables && live.figures === prev.figures;
  // text may differ slightly (md whitespace); flag large divergence only
  const textClose = Math.abs(live.text.length - prev.text.length) < live.text.length * 0.1;
  if (!idsEq || !tblEq || !textClose) {
    bad++;
    console.log("DIFF", p.slug, { idsEq, tblEq, textClose, liveTables: live.tables, prevTables: prev.tables });
  }
}
console.log(bad ? `\n${bad} pages diverge — inspect above` : "\nparity OK across all editable pages");
```

- [ ] **Step 2: Build and run parity**

Run:
```bash
corepack pnpm build && node scripts/check-parity.mjs
```
Expected: `parity OK across all editable pages`. For any `DIFF`/`MISSING` page, open both HTML files, find the converter gap (usually a heading id or a block that should have stayed raw HTML), add a converter test reproducing it (Task 3), fix, re-migrate (Task 4 Step 2), and re-run until parity is clean.

- [ ] **Step 3: Commit the checker**

```bash
git add scripts/check-parity.mjs
git commit -m "$(printf 'Add parity checker for the markdown migration\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: Cutover — serve editable pages from Markdown

Switch the real `[slug].astro` route to render editable pages from the `wiki` collection while keeping Masters pages on `pages.json`. Remove the preview scaffolding.

**Files:**
- Modify: `src/pages/[slug].astro`
- Modify: `src/data/pages.json` (drop the migrated editable pages; keep Masters)
- Delete: `src/pages/wiki-preview/[slug].astro`, `src/content/wiki/_pipeline_check.md`

**Interfaces:**
- Consumes: the `wiki` collection (editable pages) and `pages.json` filtered to `source === "liquipedia"` (Masters).
- Produces: the live routes, unchanged in output; editable pages now come from Markdown.

- [ ] **Step 1: Rewrite `[slug].astro` to merge both sources**

Modify `src/pages/[slug].astro` `getStaticPaths` to yield editable pages from the collection (rendered via `<Content/>`, TOC from `render().headings`) and Masters pages from `pages.json` (rendered via `set:html`, TOC from `page.headings`). Keep the existing hub/attribution/toggle-area logic for Masters. (Full merged route code is produced during implementation from the current `[slug].astro` — preserve every existing branch: stub badge, topical cats, Masters hub list, Liquipedia attribution, toggle-area script.)

- [ ] **Step 2: Trim `pages.json` to Masters-only**

Run:
```bash
node -e 'const fs=require("fs"); const p=JSON.parse(fs.readFileSync("src/data/pages.json","utf8")); const keep=p.filter(x=>x.source==="liquipedia"); fs.writeFileSync("src/data/pages.json", JSON.stringify(keep,null,2)); console.log("kept",keep.length,"masters pages, dropped",p.length-keep.length);'
```
Expected: keeps the Masters pages, drops the migrated editable ones. (Note: `src/lib/sidebar.js` groups from the combined set — Step 3 verifies the sidebar still lists everything.)

- [ ] **Step 3: Remove preview scaffolding and the sample page**

Run:
```bash
git rm src/pages/wiki-preview/[slug].astro src/content/wiki/_pipeline_check.md
```

- [ ] **Step 4: Build and verify the live site is unchanged**

Run:
```bash
corepack pnpm build
```
Then confirm route counts and a spot check:
```bash
node -e 'const fs=require("fs"); const n=fs.readdirSync("dist").filter(d=>fs.existsSync("dist/"+d+"/index.html")).length; console.log("routes built:",n);'
node -e 'const h=require("fs").readFileSync("dist/Warship/index.html","utf8"); console.log("Warship veterancy table:", h.includes("Gaining veterancy")); console.log("TOC anchor:", h.includes("href=\"#Gaining_veterancy\""));'
```
Expected: route count matches pre-migration (230), Warship checks print `true`. The sidebar (`BrowseSidebar` reads `pages.json` — now Masters-only) must be updated to also read the collection; if the Game Wiki groups are now empty, fix `BrowseSidebar.astro`/`src/lib/sidebar.js` to source game pages from the collection before this step passes.

- [ ] **Step 5: Run the full test suite and Pagefind index**

Run:
```bash
node --test scripts/lib/html-to-markdown.test.mjs src/lib/*.test.mjs
corepack pnpm build
```
Expected: all tests pass; Pagefind reports the same indexed-page count as before (~230).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'Cut over editable pages to the Markdown content collection\n\nEditable game/maps/guides pages now render from src/content/wiki markdown;\nMasters pages stay in pages.json as the Liquipedia mirror. Live output unchanged.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Notes for the implementer

- **Sidebar dependency:** `BrowseSidebar.astro` + `src/lib/sidebar.js` currently group game pages from `pages.json`. After cutover, game pages live in the collection. Updating the sidebar to read from the collection is part of Task 6 (Step 4 gates on it). If it grows large, keep the grouping logic in `src/lib/sidebar.js` and pass it the merged page list from the route.
- **The raw-HTML fallback** in the converter means no content is ever silently dropped — worst case a block stays as HTML. Parity (Task 5) is what catches under-conversion; extend the converter test-first when it does.
- **Do not migrate Masters.** They are a regenerated Liquipedia mirror; community editing (later phases) targets only the collection pages.
