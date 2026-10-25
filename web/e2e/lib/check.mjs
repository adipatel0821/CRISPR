// Shared browser checks for the UX2 e2e scripts (playwright-core page objects).
//
//   copyIssues(page)          dashes (U+2013/U+2014), banned phrases and "!" in the visible text AND in all text,
//                             including collapsed <details> and hidden panels. The minus sign U+2212 is not a dash.
//   axe(page, axePath)        axe-core scan (WCAG 2.0/2.1 A + AA + best practice) with reduced motion; returns the
//                             serious and critical violations.
//   primaryActions(page)      how many [data-primary-action] elements exist and how many are visible.
//   clippedElements(page)     content cut off at the screen edge (element bounds, every <details> opened). D5-003.
//   primaryActionFit(page)    the visible primary action shows its whole label and overlaps no other bar item. D5-002.
//   layoutIssues(page)        both of the above for one state: { ok, clipped, primary }.
//   noHorizontalScroll(page)  legacy: documentElement.scrollWidth <= viewport. It can never fail while html/body use
//                             overflow-x: clip, so it is NOT mobile coverage; use clippedElements + primaryActionFit.
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

/**
 * Legacy: true when the document is no wider than the viewport (1 px tolerance for sub-pixel rounding).
 * html and body use overflow-x: clip (globals.css), so content wider than the screen is cut off instead of widening
 * the document and this can never fail. Kept for continuity only; it does not count as mobile coverage (D5-003).
 */
export async function noHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

/**
 * Content a person cannot reach sideways (D5-003, reference: audit/evidence/ux3_audit/ux3_clip_probe.mjs).
 * With every <details> opened (closed again afterwards), lists the visible elements whose box extends past
 * [0, viewport width] and that are not inside a horizontally scrollable ancestor which itself fits the viewport.
 * A table that scrolls inside its card is fine; a scroll region that is itself wider than the screen is not.
 * Only leaf-ish elements are listed (own text, svg, img, form controls, buttons, tables), so one overflow is not
 * reported once per ancestor. Returns strings like 'TH "Gap with loan" [409..485] (viewport 390)'; [] = all reachable.
 */
export async function clippedElements(page, { openDetails = true, settleMs = 300 } = {}) {
  const opened = openDetails
    ? await page.evaluate(() => {
        const list = [...document.querySelectorAll("details")].filter((d) => !d.open);
        list.forEach((d) => (d.open = true));
        window.__dtCheckOpened = list;
        return list.length;
      })
    : 0;
  if (opened) await page.waitForTimeout(settleMs);
  const found = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const outside = (r) => r.right > vw + 1 || r.left < -1;
    // The first horizontally scrollable ancestor decides: inside a region that fits the screen the content can be
    // scrolled to (touch, wheel, or keyboard on a focusable region); inside a region wider than the screen it cannot.
    const reachable = (el) => {
      for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX;
        if (ox === "auto" || ox === "scroll") return !outside(a.getBoundingClientRect());
      }
      return false;
    };
    // Not rendered to the eye: opacity 0 on the element or an ancestor (e.g. the transparent form input Radix puts
    // beside a checkbox, translated left of it), visibility hidden, or content-visibility skipped.
    const seen = (el) =>
      typeof el.checkVisibility === "function" ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
    const LEAF = new Set(["svg", "IMG", "INPUT", "SELECT", "TEXTAREA", "BUTTON", "TABLE", "VIDEO", "CANVAS"]);
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden" || st.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue; // sr-only text and hairlines
      if (!outside(r)) continue;
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText && !LEAF.has(el.tagName)) continue;
      if (!seen(el)) continue;
      if (reachable(el)) continue;
      const text = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      out.push(`${el.tagName} "${text}" [${Math.round(r.left)}..${Math.round(r.right)}] (viewport ${vw})`);
    }
    return out;
  });
  if (opened) {
    await page.evaluate(() => {
      (window.__dtCheckOpened || []).forEach((d) => (d.open = false));
      delete window.__dtCheckOpened;
    });
    await page.waitForTimeout(settleMs);
  }
  return found;
}

/**
 * The visible primary action is readable (D5-002, reference: audit/evidence/ux3_audit/ux3_actionbar_probe.mjs).
 * For each visible [data-primary-action]:
 *   - scrollWidth <= clientWidth (the label does not overflow its pill) and no vertical overflow;
 *   - the label text sits inside the pill, inside the screen, and is not cut by an ancestor that clips;
 *   - the pill overlaps no other visible control of its bar ([data-action-row] when it sits in one, otherwise the
 *     nearest ancestor holding another control), and no other control of that bar is itself cut off (scrollWidth >
 *     clientWidth), so secondary items yield by wrapping, not by truncating.
 * Returns { visible, items: [{ label, width, scrollWidth, clientWidth, problems }], problems }; problems [] = pass.
 */
export async function primaryActionFit(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const shown = (el) =>
      (typeof el.checkVisibility === "function" ? el.checkVisibility({ checkVisibilityCSS: true }) : true) &&
      el.getBoundingClientRect().width > 0;
    const CONTROLS = "a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=radio],[role=checkbox]";
    const others = (scope, el) => [...scope.querySelectorAll(CONTROLS)].filter((x) => x !== el && !el.contains(x) && !x.contains(el) && shown(x));
    const name = (x) => (x.innerText || x.getAttribute("aria-label") || x.tagName).replace(/\s+/g, " ").trim().slice(0, 40);
    const items = [];
    for (const el of document.querySelectorAll("[data-primary-action]")) {
      if (!shown(el)) continue;
      const r = el.getBoundingClientRect();
      const label = el.innerText.replace(/\s+/g, " ").trim();
      const problems = [];
      if (el.scrollWidth > el.clientWidth) problems.push(`label overflows the pill by ${el.scrollWidth - el.clientWidth}px (pill ${Math.round(r.width)}px)`);
      if (el.scrollHeight > el.clientHeight + 1) problems.push(`label overflows the pill vertically by ${el.scrollHeight - el.clientHeight}px`);
      if (r.left < -1 || r.right > vw + 1) problems.push(`pill past the screen edge [${Math.round(r.left)}..${Math.round(r.right)}]`);
      // where the label text actually is (text nodes only, not the arrow icon)
      let tl = Infinity;
      let tr = -Infinity;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const q of range.getClientRects()) {
          if (q.width <= 0) continue;
          tl = Math.min(tl, q.left);
          tr = Math.max(tr, q.right);
        }
      }
      if (tl === Infinity) problems.push("no visible label text");
      else {
        if (tl < r.left - 0.5 || tr > r.right + 0.5)
          problems.push(`label text [${Math.round(tl)}..${Math.round(tr)}] spills outside the pill [${Math.round(r.left)}..${Math.round(r.right)}]`);
        if (tl < -1 || tr > vw + 1) problems.push(`label text past the screen edge [${Math.round(tl)}..${Math.round(tr)}]`);
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          if (getComputedStyle(a).overflowX === "visible") continue;
          const ar = a.getBoundingClientRect();
          if (tl < ar.left - 0.5 || tr > ar.right + 0.5) {
            problems.push(`label text cut by its ${a.tagName.toLowerCase()} container [${Math.round(ar.left)}..${Math.round(ar.right)}]`);
            break;
          }
        }
      }
      let bar = el.closest("[data-action-row]");
      for (let a = el.parentElement; !bar && a && a !== document.body; a = a.parentElement) if (others(a, el).length) bar = a;
      if (bar) {
        const hits = [];
        const cut = [];
        for (const x of others(bar, el)) {
          const q = x.getBoundingClientRect();
          if (q.width < 2 || q.height < 2) continue;
          const ix = Math.min(q.right, r.right) - Math.max(q.left, r.left);
          const iy = Math.min(q.bottom, r.bottom) - Math.max(q.top, r.top);
          if (ix > 0.5 && iy > 0.5) hits.push(name(x));
          if (x.matches("[data-action-row] a, [data-action-row] button") && x.scrollWidth > x.clientWidth) cut.push(name(x));
        }
        if (hits.length) problems.push(`overlaps ${JSON.stringify(hits)}`);
        if (cut.length) problems.push(`bar item cut off: ${JSON.stringify(cut)}`);
      }
      items.push({ label, width: Math.round(r.width), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, problems });
    }
    return { visible: items.length, items, problems: items.flatMap((i) => i.problems.map((p) => `"${i.label}": ${p}`)) };
  });
}

/** Both phone-layout checks for the current state: { ok, clipped, primary } (see clippedElements, primaryActionFit). */
export async function layoutIssues(page, opts) {
  const clipped = await clippedElements(page, opts);
  const primary = await primaryActionFit(page);
  return { ok: clipped.length === 0 && primary.problems.length === 0, clipped, primary };
}

/** First-viewport metrics (lib/density.mjs measure().fold) plus the viewport size. */
export async function foldStats(page) {
  const m = await measure(page);
  return { viewport: m.viewport, ...m.fold, visible: m.visible, all: m.all };
}
