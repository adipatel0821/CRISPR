// UX3 Decision summary + Stress test: live browser check through the real API (sessions seeded via the API, the
// same reference case as ux_b_flow.mjs). Ports every value assertion of ux_b_flow.mjs for these two screens and adds
// the UX3 checks: the summary is ONE result card (result on top: big figure, bars, savings line, running-costs note
// and its absence with refinements; everything else behind "Show all details", collapsed by default, aria-expanded,
// keyboard, hash and print open it), scenario switching, the cost-rise limitation, one primary action, copy, axe,
// no sideways scroll at 390/360 px, and a small loan ($5,000 over 24 months) whose four-digit figure stays on one line.
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3302 API=http://localhost:8302 node s3_summary_stress.mjs [screenshot-dir]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { BANNED_PHRASES } from "./lib/density.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const WEB = process.env.WEB || "http://localhost:3302";
const API = (process.env.API || "http://localhost:8302") + "/api/v1";
const OUT = process.argv[2] || ".";
fs.mkdirSync(OUT, { recursive: true });

const HOUSEHOLD = [
  { key: "income.take_home_monthly", value: "4200" },
  { key: "expenses.essential.total", value: "2900" },
  { key: "debts.count", value: "0" },
  { key: "savings.liquid", value: "6000" },
  { key: "loan.down_payment_source", value: "savings" },
];
const REFINEMENTS = [
  { key: "vehicle.new_ownership_costs_monthly", value: "310" },
  { key: "vehicle.replaces_current", value: "true" },
  { key: "expenses.current_vehicle_costs_monthly", value: "260" },
  { key: "expenses.flexible.total", value: "400" },
];
const OFFER = {
  label: "Dealer offer A",
  confirmed: true,
  terms: {
    cash_price: "22000.00", taxes_title_fees: "1500.00", cash_down: "4000.00", principal: "20000.00",
    amount_financed: "19500.00", prepaid_finance_charges: "500.00", contract_rate: "0.0475", apr: "0.05796",
    term_months: 60, monthly_payment: "375.14",
  },
};
// The owner's household style: a $5,000 car over 24 months.
const SMALL_HOUSEHOLD = [
  { key: "income.take_home_monthly", value: "3100" },
  { key: "expenses.essential.total", value: "840" },
  { key: "debts.count", value: "0" },
  { key: "savings.liquid", value: "5000" },
  { key: "loan.down_payment_source", value: "savings" },
];
const SMALL_OFFER = {
  label: "",
  confirmed: true,
  terms: {
    cash_price: "5000.00", cash_down: "1000.00", principal: "4000.00", amount_financed: "4000.00",
    prepaid_finance_charges: "0.00", contract_rate: "0.069", apr: "0.069", term_months: 24,
  },
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " :: " + detail : ""}`);
}

async function api(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function seed(facts, offer = OFFER) {
  const s = await api("POST", "/sessions", {});
  await api("POST", `/sessions/${s.session_id}/facts`, { facts }, s.token);
  const offerId = (await api("POST", `/sessions/${s.session_id}/offers`, offer, s.token)).offer_id;
  const analysis = await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token);
  return { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId: analysis.report_id, report: analysis };
}

async function context(browser, seedInfo, viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const { sessionId, token, dataMode, offerId, reportId } = seedInfo;
  await ctx.addInitScript((v) => {
    sessionStorage.setItem("dt.session_id", v.sessionId);
    sessionStorage.setItem("dt.token", v.token);
    sessionStorage.setItem("dt.data_mode", v.dataMode);
    sessionStorage.setItem("dt.consent", "1");
    sessionStorage.setItem("dt.offer_id", v.offerId);
    sessionStorage.setItem("dt.report_id", v.reportId);
  }, { sessionId, token, dataMode, offerId, reportId });
  return ctx;
}

/** The result card's disclosure: toggle state, what it controls, whether the details region is shown. */
const cardState = (page) =>
  page.evaluate(() => {
    const t = document.querySelector("[data-result-card] [data-card-toggle]");
    const region = document.querySelector("[data-result-card] [data-card-details]");
    return {
      cards: document.querySelectorAll("[data-result-card]").length,
      expanded: t?.getAttribute("aria-expanded") ?? null,
      controlsRegion: !!t && !!region && t.getAttribute("aria-controls") === region.id,
      toggleName: t?.textContent.replace(/\s+/g, " ").trim() ?? "",
      detailsShown: !!region && region.checkVisibility({ checkVisibilityCSS: true }),
      focusOnToggle: document.activeElement === t,
    };
  });

async function axeSerious(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (!(await page.evaluate(() => typeof window.axe !== "undefined"))) await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  for (const v of r) console.log(`     - [${v.impact}] ${v.id} x${v.n} :: ${v.targets.join(" | ")}`);
  return r.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

const visibleText = (page) =>
  page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (el && el.checkVisibility && el.checkVisibility({ checkVisibilityCSS: true })) out.push(n.textContent);
    }
    return out.join(" ");
  });

const BANNED = BANNED_PHRASES;
async function copyProblems(page) {
  const all = await page.evaluate(() => {
    const parts = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest("script,style,noscript,template")) return NodeFilter.FILTER_REJECT;
        return n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (w.nextNode()) parts.push(w.currentNode.textContent);
    for (const el of document.querySelectorAll("[aria-label],[title],[placeholder],img[alt]"))
      for (const a of ["aria-label", "title", "placeholder", "alt"]) { const v = el.getAttribute(a); if (v) parts.push(v); }
    return parts.join("\n");
  });
  const issues = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i] === "–" || all[i] === "—") issues.push("dash: " + all.slice(Math.max(0, i - 30), i + 30).replace(/\s+/g, " "));
    else if (all[i] === "!" && i > 0 && /[A-Za-z0-9)]/.test(all[i - 1])) issues.push("exclamation: " + all.slice(Math.max(0, i - 30), i + 2));
  }
  const lower = all.toLowerCase();
  for (const b of BANNED) if (lower.includes(b)) issues.push("banned: " + b);
  return issues;
}

const primaries = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll("[data-primary-action]")];
    const shown = (e) => e.checkVisibility({ checkVisibilityCSS: true });
    return { total: els.length, visible: els.filter(shown).length, text: els.map((e) => e.textContent.trim()), hrefs: els.filter(shown).map((e) => e.getAttribute("href")) };
  });
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const h1Count = (page) => page.locator("h1").count();

async function shoot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  await page.screenshot({ path: path.join(OUT, `${name}_full.png`), fullPage: true });
}

const consoleErrors = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const ref = await seed(HOUSEHOLD);
  const refined = await seed([...HOUSEHOLD, ...REFINEMENTS]);

  /* ----------------------------------------------- Summary, 1440 ----------------------------------------------- */
  const ctx = await context(browser, ref, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
  await page.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  const dash = await page.textContent("body");
  for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "1,300", "924.86", "2,000"]) check(`summary shows ${v}`, dash.includes(v));
  check('savings before shown as $6,000 (not "Not known")', dash.includes("6,000.00") && !/Not known/.test(dash));
  check("labels discretionary spending and running costs", /discretionary/i.test(dash) && /running costs/i.test(dash));
  check("summary is live data (no fixture banner)", !/fixture/i.test(dash));
  check('no "verified" wording', !/\bverified\b/i.test(dash));
  check("assumption chips on left-each-month / running costs (D1-001)", (await page.locator("[data-caveat=assumption]").count()) >= 2);
  check(
    "no assumption chip on the loan-cost figures",
    (await page.getByRole("button", { name: /Includes an assumption for (Monthly payment|Finance charge|Total of payments)/ }).count()) === 0,
  );
  // The card, closed: the result is visible; the secondary figures are in the DOM but not shown.
  const visible = await visibleText(page);
  for (const v of ["2,000.00", "1,300.00", "924.86", "6,000.00", "375.14"]) check(`summary VISIBLE (card closed) ${v}`, visible.includes(v));
  const c0 = await cardState(page);
  check("one result card", c0.cards === 1, JSON.stringify(c0));
  check('details collapsed by default (aria-expanded="false", region hidden)', c0.expanded === "false" && !c0.detailsShown, JSON.stringify(c0));
  check("toggle controls the details region (aria-controls)", c0.controlsRegion, JSON.stringify(c0));
  check('toggle reads "Show all details"', /^Show all details/.test(c0.toggleName) && (await page.getByRole("button", { name: "Show all details", exact: true }).count()) === 1, c0.toggleName);
  for (const v of ["22,508.29", "3,008.29", "26,508.29", "2,508.29", "3,625.42"]) check(`secondary figure ${v} not shown until the card opens`, !visible.includes(v));
  check("details headings not shown until the card opens", !/Things we flagged|Assumptions and limitations|Every source/.test(visible));
  check("running-costs limitation visible", /running costs/i.test(visible) && /aren.t included/i.test(visible));
  check('running-costs note has "Add them"', (await page.locator("[data-running-costs-note] a", { hasText: "Add them" }).count()) === 1);
  check("discretionary label visible", /discretionary/i.test(visible));
  const bad = visible.match(/you can afford|\bsafe\b|recommended|\bbest\b|\bshould\b|\bverified\b|approved/i);
  check("no approval / verdict language (visible)", !bad, bad ? bad[0] : "");

  // Hero: the big figure is the first thing, inside the first viewport, larger than everything else.
  const big = page.locator("[data-big-figure]").first();
  const bigText = (await big.innerText()).replace(/\s+/g, " ");
  check("big figure is $924.86 left each month", /924\.86/.test(bigText) && /left each month/i.test(bigText), bigText);
  const bigBox = await big.locator("p.figure").boundingBox();
  const bigSize = await big.locator("p.figure").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  check("big figure above the fold at 1440x900", bigBox && bigBox.y + bigBox.height <= 900, JSON.stringify(bigBox));
  check("big figure at least 56px", bigSize >= 56, String(bigSize));
  check("big figure on one line", bigBox && bigBox.height < bigSize * 1.5, `${bigBox?.height} for ${bigSize}px`);
  check("big figure is the top of the card", await page.evaluate(() => document.querySelector("[data-result-card] [data-summary-hero] [data-big-figure]") !== null));
  const bars = await page.locator("[data-summary-hero] [data-value-bars] li").allInnerTexts();
  check("before/after bars: $1,300.00 then $924.86", bars.length === 2 && bars[0].includes("1,300.00") && bars[1].includes("924.86"), JSON.stringify(bars));
  const widths = await page.locator("[data-summary-hero] [data-value-bars] .dt-bar").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
  check("bars share one zero-based scale (924.86/1300 ratio)", widths.length === 2 && Math.abs(widths[1] / widths[0] - 924.86 / 1300) < 0.02, JSON.stringify(widths));
  const savingsLine = (await page.locator("[data-summary-hero] [data-savings-line]").innerText()).replace(/\s+/g, " ");
  check("savings line: from $6,000.00 to $2,000.00 after the down payment", /from \$6,000\.00 to \$2,000\.00 after the down payment/.test(savingsLine), savingsLine);
  const p1 = await primaries(page);
  check("one primary action (visible), to /stress", p1.visible === 1 && p1.hrefs[0] === "/stress", JSON.stringify(p1));
  check("primary action is the blue pill", (await page.locator("[data-primary-action]:visible").evaluate((el) => getComputedStyle(el).backgroundColor)) === "rgb(42, 100, 227)");
  check("primary action sits in the card's result area", await page.evaluate(() => [...document.querySelectorAll("[data-primary-action]")].some((e) => e.checkVisibility() && e.closest("[data-summary-hero]"))));
  const toggleBox = await page.locator("[data-card-toggle]").boundingBox();
  check("Show all details is on the first screen at 1440x900", toggleBox && toggleBox.y + toggleBox.height <= 900, JSON.stringify(toggleBox));
  check("one h1", (await h1Count(page)) === 1);
  check('h1 is "Here\'s how this loan changes your month."', /Here.s how this loan changes your month\./.test(await page.locator("h1").innerText()));
  check("rail shows loan context", /Car price[\s\S]*22,000\.00[\s\S]*Monthly payment[\s\S]*375\.14/.test(await page.locator("aside[data-stage-rail]").innerText()));
  check("journey rows: Summary current, Stress test, Options, Report", (await page.locator("aside nav[data-journey] li").count()) === 4 && (await page.locator('aside [aria-current="step"]').innerText()).includes("Summary"));
  await shoot(page, "summary_1440");
  let ax = await axeSerious(page);
  check("axe /dashboard: no serious/critical", ax.length === 0, ax.join(", "));
  let cp = await copyProblems(page);
  check("copy: no dashes, banned phrases or exclamations", cp.length === 0, cp.slice(0, 3).join(" | "));

  // A source opens in one click.
  await page.locator("[data-big-figure] [data-source-link]").first().click();
  await page.waitForTimeout(300);
  check("source popover opens in one click", (await page.locator("[data-radix-popper-content-wrapper]").count()) >= 1);
  await page.keyboard.press("Escape");

  // Show all details: the keyboard opens the same card in place; every secondary figure and source is there.
  await page.locator("[data-card-toggle]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const c1 = await cardState(page);
  check('keyboard (Enter) opens the details (aria-expanded="true", region shown)', c1.expanded === "true" && c1.detailsShown, JSON.stringify(c1));
  check('toggle now reads "Hide details" and keeps focus', /^Hide details/.test(c1.toggleName) && c1.focusOnToggle, JSON.stringify(c1));
  check("details open inside the same card", await page.evaluate(() => !!document.querySelector("[data-result-card] [data-card-details] #loan-cost")));
  const open = await visibleText(page);
  for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29"]) check(`details VISIBLE ${v}`, open.includes(v));
  check("details: finance charge = interest 2,508.29 + fees 500.00", open.includes("2,508.29") && open.includes("500.00"));
  check("details: APR check 5.796%", open.includes("5.796%") && /They agree/.test(open));
  check("details: reserve 2.07 -> 0.61 months", /2\.07 months/.test(open) && /0\.61 months/.test(open), open.match(/cover.{0,80}/)?.[0]);
  check("details: main concern (What to look at next): savings run out in month 2, shortfall 3,625.42", /What to look at next/.test(open) && /month 2/.test(open) && open.includes("3,625.42"));
  check("details: an option worth exploring", /Worth exploring/.test(open));
  check("details: flags with citations, assumptions, unknowns, every source", /Things we flagged/.test(open) && /CFPB Making Ends Meet/.test(open) && /Assumptions and limitations/.test(open) && /What we don.t know/.test(open) && /Every source \(\d+\)/.test(open));
  const shownSources = await page.locator("[data-result-card] [data-source-link]").evaluateAll((els) => els.filter((e) => e.checkVisibility()).length);
  check("details: How we got this on every figure (8+ sources shown)", shownSources >= 8, String(shownSources));
  // The details quote the backend's "the rate the lender approved" (the buy rate); a verdict about the person is what's banned.
  const badOpen = open.match(/you can afford|\bsafe\b|recommended|\bbest\b|\bshould\b|\bverified\b|\byou(?:'re|’re| are| would be| will be)? (?:be )?approved\b/i);
  check("no approval / verdict language (details open)", !badOpen, badOpen ? badOpen[0] : "");
  check("one primary action with the details open", (await primaries(page)).visible === 1);
  await page.screenshot({ path: path.join(OUT, "summary_1440_open.png"), fullPage: true });
  ax = await axeSerious(page);
  check("axe /dashboard (details open): no serious/critical", ax.length === 0, ax.join(", "));
  cp = await copyProblems(page);
  check("copy (details open) clean", cp.length === 0, cp.slice(0, 3).join(" | "));

  // Toggle back with a click; then open again and close from the bottom "Hide details" (focus returns to the toggle).
  await page.locator("[data-card-toggle]").click();
  await page.waitForTimeout(400);
  const c2 = await cardState(page);
  check('click closes the details (aria-expanded="false", "Show all details")', c2.expanded === "false" && !c2.detailsShown && /^Show all details/.test(c2.toggleName), JSON.stringify(c2));
  check("closed again: secondary figures hidden", !(await visibleText(page)).includes("22,508.29"));
  await page.keyboard.press("Space");
  await page.waitForTimeout(400);
  check("Space opens it again", (await cardState(page)).expanded === "true");
  await page.locator("[data-card-hide]").click();
  await page.waitForTimeout(500);
  const c3 = await cardState(page);
  check("bottom Hide details closes and returns focus to the toggle", c3.expanded === "false" && !c3.detailsShown && c3.focusOnToggle, JSON.stringify(c3));

  // Printing shows everything; a link to #assumptions opens the card at that section.
  await page.emulateMedia({ media: "print" });
  check("print: details printed even when closed", await page.evaluate(() => document.querySelector("[data-card-details]").checkVisibility({ checkVisibilityCSS: true })));
  check("print: no toggle, no primary pill", await page.evaluate(() => !document.querySelector("[data-card-toggle]").checkVisibility() && ![...document.querySelectorAll("[data-primary-action]")].some((e) => e.checkVisibility())));
  await page.emulateMedia({ media: "screen" });
  await page.goto(WEB + "/dashboard#assumptions", { waitUntil: "networkidle" });
  await page.locator("[data-summary-hero]").waitFor();
  await page.waitForTimeout(600);
  const c4 = await cardState(page);
  check("#assumptions opens the details and shows that section", c4.expanded === "true" && (await page.locator("#assumptions").isVisible()), JSON.stringify(c4));

  // Other widths, closed and open.
  for (const [w, h] of [[1920, 1080], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
    await page.locator("[data-summary-hero]").waitFor();
    await page.waitForTimeout(300);
    const ov = await sideways(page);
    check(`/dashboard no horizontal scroll at ${w}`, ov <= 0, `${ov}px`);
    const pa = await primaries(page);
    check(`/dashboard one visible primary at ${w}`, pa.visible === 1, JSON.stringify(pa));
    check(`/dashboard details collapsed at ${w}`, (await cardState(page)).expanded === "false");
    await shoot(page, `summary_${w}`);
    await page.locator("[data-card-toggle]").click();
    await page.waitForTimeout(400);
    check(`/dashboard details open at ${w}`, (await cardState(page)).detailsShown && (await visibleText(page)).includes("26,508.29"));
    const ov2 = await sideways(page);
    check(`/dashboard no horizontal scroll at ${w} (details open)`, ov2 <= 0, `${ov2}px`);
    await page.screenshot({ path: path.join(OUT, `summary_${w}_open.png`), fullPage: true });
  }
  // Still at 390 (the loop's last width), details open.
  const bars390 = await page.locator("[data-summary-hero] [data-value-bars]").boundingBox();
  const fig390 = await page.locator("[data-summary-hero] [data-big-figure]").boundingBox();
  check("390: bars stack under the figure", bars390 && fig390 && bars390.y >= fig390.y + fig390.height - 1, JSON.stringify({ bars390, fig390 }));
  const dock = await page.evaluate(() => {
    const el = [...document.querySelectorAll("[data-primary-action]")].find((e) => e.checkVisibility());
    return el ? { inRow: !!el.closest("[data-action-row]"), pos: getComputedStyle(el.closest("[data-action-row]") ?? el).position } : null;
  });
  check("390: the primary action docks at the bottom", dock?.inRow && dock.pos === "sticky", JSON.stringify(dock));
  ax = await axeSerious(page);
  check("axe /dashboard at 390 (details open): no serious/critical", ax.length === 0, ax.join(", "));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  check("/dashboard no horizontal scroll at 360", (await sideways(page)) <= 0);
  await page.locator("[data-card-toggle]").click();
  await page.waitForTimeout(400);
  check("/dashboard no horizontal scroll at 360 (details open)", (await sideways(page)) <= 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
  await page.locator("[data-summary-hero]").waitFor();
  await page.waitForTimeout(300);
  ax = await axeSerious(page);
  check("axe /dashboard at 390: no serious/critical", ax.length === 0, ax.join(", "));

  /* ----------------------------------------------- Stress, 1440 ----------------------------------------------- */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WEB + "/stress", { waitUntil: "networkidle" });
  await page.locator("[data-stress-finding]").waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  const st = await page.textContent("main");
  check("/stress renders results", st.length > 500 && !/Start a session first|Something went wrong/i.test(st));
  check("stress labelled illustrative", /Illustrative scenario, not a prediction/.test(st));
  check("one h1 (the scenario question)", (await h1Count(page)) === 1);
  const h1 = await page.locator("h1").innerText();
  check("most consequential first: no income for two months", /income stopped for two months/i.test(h1), h1);
  const finding = (await page.locator("[data-stress-finding]").innerText()).replace(/\s+/g, " ");
  check("finding: savings run out in month 2", /Savings run out in month 2/.test(finding), finding);
  check("finding: $3,625.42 modelled shortfall", /3,625\.42/.test(finding) && /modelled shortfall/i.test(finding), finding);
  check("trajectory chart drawn", (await page.locator("[data-trajectory-chart] svg .recharts-line").count()) >= 2);
  check("gap shown below zero", (await page.locator("[data-trajectory-chart] svg .recharts-bar-rectangle").count()) >= 1);
  const p2 = await primaries(page);
  check("stress: one primary action to /alternatives", p2.total === 1 && p2.visible === 1 && p2.hrefs[0] === "/alternatives", JSON.stringify(p2));
  check("monthly table collapsed", (await page.locator("details[data-month-table]").evaluate((d) => !d.open)));
  await shoot(page, "stress_1440");
  ax = await axeSerious(page);
  check("axe /stress: no serious/critical", ax.length === 0, ax.join(", "));
  cp = await copyProblems(page);
  check("copy /stress clean", cp.length === 0, cp.slice(0, 3).join(" | "));

  // Scenario switching: keyboard (arrows) moves the selection and updates finding + chart.
  const tabs = page.getByRole("tab");
  const nTabs = await tabs.count();
  check("scenario tiles: one per scenario (4)", nTabs === 4, String(nTabs));
  const firstSel = page.locator('[role=tab][aria-selected="true"]');
  await firstSel.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const h1b = await page.locator("h1").innerText();
  const findingB = (await page.locator("[data-stress-finding]").innerText()).replace(/\s+/g, " ");
  check("arrow key switches scenario (h1 changes)", h1b !== h1, `${h1} -> ${h1b}`);
  check("finding updates on switch", findingB !== finding, findingB);
  check("focus follows the selected tile", await page.evaluate(() => document.activeElement?.getAttribute("aria-selected") === "true"));
  // Click through every tile; the cost-rise one shows a limitation, not a result.
  let sawLimitation = false;
  for (let i = 0; i < nTabs; i++) {
    await tabs.nth(i).click();
    await page.waitForTimeout(250);
    const title = await page.locator("h1").innerText();
    if (/running the car cost/i.test(title)) {
      const t = (await page.locator("[role=tabpanel]").innerText()).replace(/\s+/g, " ");
      sawLimitation = /running costs/i.test(t) && /aren.t included/i.test(t) && !/Savings last all/.test(t) && (await page.locator("[role=tabpanel] [data-trajectory-chart]").count()) === 0;
      check("cost-rise scenario: limitation instead of a result", sawLimitation, t.slice(0, 200));
      await page.screenshot({ path: path.join(OUT, "stress_1440_costrise.png"), fullPage: false });
    }
    check(`tile ${i + 1} keeps one primary action`, (await primaries(page)).visible === 1);
  }
  check("cost-rise tile present", sawLimitation);
  await tabs.first().click();
  await page.locator("details[data-month-table] > summary").click();
  await page.waitForTimeout(300);
  const tableText = await page.locator("details[data-month-table]").innerText();
  check("monthly table opens with the gap values", /3,625\.42/.test(tableText));
  check("break-even in details", /37%/.test(await page.textContent("main")));
  await page.screenshot({ path: path.join(OUT, "stress_1440_open.png"), fullPage: true });
  ax = await axeSerious(page);
  check("axe /stress (details open): no serious/critical", ax.length === 0, ax.join(", "));
  cp = await copyProblems(page);
  check("copy /stress (details open) clean", cp.length === 0, cp.slice(0, 3).join(" | "));

  for (const [w, h] of [[1920, 1080], [768, 1024], [390, 844], [360, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(WEB + "/stress", { waitUntil: "networkidle" });
    await page.locator("[data-stress-finding]").waitFor();
    await page.waitForTimeout(300);
    const ov = await sideways(page);
    check(`/stress no horizontal scroll at ${w}`, ov <= 0, `${ov}px`);
    if (w !== 360) await shoot(page, `stress_${w}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  ax = await axeSerious(page);
  check("axe /stress at 390: no serious/critical", ax.length === 0, ax.join(", "));
  await ctx.close();

  /* ------------------------------------- With refinements: 900.00 -> 474.86 ------------------------------------- */
  const ctx2 = await context(browser, refined, { width: 1440, height: 900 });
  const p = await ctx2.newPage();
  p.on("pageerror", (e) => consoleErrors.push(String(e)));
  await p.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
  await p.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
  await p.waitForTimeout(300);
  const rv = await visibleText(p);
  check("refined: big figure $474.86", /474\.86/.test(await p.locator("[data-big-figure]").first().innerText()));
  check("refined: bars $900.00 -> $474.86", rv.includes("900.00") && rv.includes("474.86"));
  check("refined: running-costs note absent", (await p.locator("[data-running-costs-note]").count()) === 0 && !/aren.t included/i.test(rv));
  await shoot(p, "summary_1440_refined");
  await p.goto(WEB + "/stress", { waitUntil: "networkidle" });
  await p.locator("[data-stress-finding]").waitFor();
  const tabs2 = p.getByRole("tab");
  let costRiseResult = false;
  for (let i = 0; i < (await tabs2.count()); i++) {
    await tabs2.nth(i).click();
    await p.waitForTimeout(200);
    if (/running the car cost/i.test(await p.locator("h1").innerText())) costRiseResult = (await p.locator("[role=tabpanel] [data-trajectory-chart]").count()) === 1;
  }
  check("refined: cost-rise scenario shows a result (running costs known)", costRiseResult);
  await ctx2.close();

  /* ---------------------------- The owner's household style: a $5,000 car over 24 months ---------------------------- */
  const small = await seed(SMALL_HOUSEHOLD, SMALL_OFFER);
  const m = (k) => small.report.with_offer?.metrics?.[k]?.value ?? small.report.baseline?.metrics?.[k]?.value ?? null;
  // test-side formatting of backend strings (no arithmetic): "2081.09" -> "$2,081.09"
  const money = (s) => (s === null ? "Not known" : `${s.startsWith("-") ? "−" : ""}$${Number(s.replace("-", "")).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const sm = { after: money(m("monthly_left_after")), before: money(m("monthly_left_before")), pay: money(m("monthly_payment")), top: money(m("total_of_payments")), fc: money(m("finance_charge")), deal: money(m("total_paid_through_deal")), sav: money(m("savings_after_purchase")) };
  const ctx3 = await context(browser, small, { width: 1440, height: 900 });
  const q = await ctx3.newPage();
  q.on("pageerror", (e) => consoleErrors.push(String(e)));
  for (const [w, h] of [[1440, 900], [390, 844], [360, 800]]) {
    await q.setViewportSize({ width: w, height: h });
    await q.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
    await q.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
    await q.waitForTimeout(300);
    const fig = q.locator("[data-summary-hero] [data-big-figure] p.figure");
    const figText = (await fig.innerText()).replace(/\s+/g, "");
    const figBox = await fig.boundingBox();
    const figSize = await fig.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    check(`small loan ${w}: big figure is ${sm.after}`, figText === sm.after, figText);
    check(`small loan ${w}: four-digit figure stays on one line`, figBox && figBox.height < figSize * 1.5, `${figBox?.height}px for ${figSize}px`);
    if (w === 1440) check("small loan 1440: figure still large (>= 56px)", figSize >= 56, String(figSize));
    const sb = await q.locator("[data-summary-hero] [data-value-bars] li").allInnerTexts();
    check(`small loan ${w}: bars ${sm.before} then ${sm.after}`, sb.length === 2 && sb[0].includes(sm.before) && sb[1].includes(sm.after), JSON.stringify(sb));
    const sl = (await q.locator("[data-summary-hero] [data-savings-line]").innerText()).replace(/\s+/g, " ");
    check(`small loan ${w}: savings line ends at ${sm.sav}`, sl.includes(`to ${sm.sav} after the down payment`), sl);
    check(`small loan ${w}: no horizontal scroll`, (await sideways(q)) <= 0);
    if (w !== 360) await q.screenshot({ path: path.join(OUT, `summary_small_${w}.png`), fullPage: false });
    await q.locator("[data-card-toggle]").click();
    await q.waitForTimeout(400);
    const sv = await visibleText(q);
    check(`small loan ${w}: details show payment, total of payments, finance charge, total through the deal`, [sm.pay, sm.top, sm.fc, sm.deal].every((v) => sv.includes(v)), JSON.stringify(sm));
    check(`small loan ${w}: no horizontal scroll (details open)`, (await sideways(q)) <= 0);
    if (w !== 360) await q.screenshot({ path: path.join(OUT, `summary_small_${w}_open.png`), fullPage: true });
  }
  ax = await axeSerious(q);
  check("axe small loan (details open, 360): no serious/critical", ax.length === 0, ax.join(", "));
  await ctx3.close();
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 400));
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
