// Shared browser checks for the UX2 e2e scripts (playwright-core page objects).
//
//   copyIssues(page)          dashes (U+2013/U+2014), banned phrases and "!" in the visible text AND in all text,
//                             including collapsed <details> and hidden panels. The minus sign U+2212 is not a dash.
//   axe(page, axePath)        axe-core scan (WCAG 2.0/2.1 A + AA + best practice) with reduced motion; returns the
//                             serious and critical violations.
//   primaryActions(page)      how many [data-primary-action] elements exist and how many are visible.
//   noHorizontalScroll(page)  true when the page does not scroll sideways.
//   foldStats(page)           first-viewport metrics from lib/density.mjs (words, dollar figures, controls, ...).
import fs from "node:fs";
import { BANNED_PHRASES, measure } from "./density.mjs";

function issuesIn(text, banned) {
  const s = String(text ?? "");
  const around = (i) => s.slice(Math.max(0, i - 30), i + 31).replace(/\s+/g, " ").trim();
  const dashes = [];
  const exclamations = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "–" || s[i] === "—") dashes.push(around(i));
    // a word ending in "!" ("Saved!"), not "!important" style tokens
    else if (s[i] === "!" && i > 0 && /[A-Za-z0-9)’]/.test(s[i - 1])) exclamations.push(around(i));
  }
  const lower = s.toLowerCase().replace(/’/g, "'");
  return { dashes, banned: banned.filter((p) => lower.includes(p)), exclamations };
}

/**
 * Editorial issues on the current page.
 *  visible: document.body.innerText (what is rendered; collapsed details excluded)
 *  all:     every text node, attribute text people hear (aria-label, title, placeholder, alt) and <details> content
 */
export async function copyIssues(page) {
  const { visible, all } = await page.evaluate(() => {
    const parts = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest("script,style,noscript,template")) return NodeFilter.FILTER_REJECT;
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (walker.nextNode()) parts.push(walker.currentNode.textContent);
    for (const el of document.querySelectorAll("[aria-label],[title],[placeholder],img[alt]")) {
      for (const a of ["aria-label", "title", "placeholder", "alt"]) {
        const v = el.getAttribute(a);
        if (v) parts.push(v);
      }
    }
    return { visible: document.body.innerText, all: parts.join("\n") };
  });
  return { visible: issuesIn(visible, BANNED_PHRASES), all: issuesIn(all, BANNED_PHRASES) };
}

/** True when copyIssues() found nothing anywhere. */
export function copyClean(result) {
  return ["visible", "all"].every((k) => !result[k].dashes.length && !result[k].banned.length && !result[k].exclamations.length);
}

/**
 * axe-core scan. `axePath` is the path to axe.min.js. Emulates prefers-reduced-motion so mid-fade colours don't
 * produce false contrast hits. Returns { serious, all } where `serious` lists serious + critical violations.
 */
export async function axe(page, axePath) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const loaded = await page.evaluate(() => typeof window.axe !== "undefined");
  if (!loaded) await page.addScriptTag({ content: fs.readFileSync(axePath, "utf8") });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  return { serious: res.filter((v) => v.impact === "serious" || v.impact === "critical"), all: res };
}

/** { total, visible }: [data-primary-action] elements in the DOM and those actually rendered. */
export async function primaryActions(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-primary-action]")];
    const shown = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility({ checkVisibilityCSS: true }) : true);
    return { total: els.length, visible: els.filter(shown).length, labels: els.filter(shown).map((e) => e.textContent.trim()) };
  });
}

/** True when the document is no wider than the viewport (1 px tolerance for sub-pixel rounding). */
export async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

/** First-viewport metrics (lib/density.mjs measure().fold) plus the viewport size. */
export async function foldStats(page) {
  const m = await measure(page);
  return { viewport: m.viewport, ...m.fold, visible: m.visible, all: m.all };
}
