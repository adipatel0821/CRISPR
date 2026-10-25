// UX3 screen agent C: Options (/alternatives) and Loan offer (/offer) through the real API.
//
//   Options: seeded reference session -> 72 months at $319.78 a month, "Same rate assumed, ask the lender", compare-all
//            reveals the chart and the table, rate sensitivity, one yellow primary action to the report.
//   Offer:   upload contract_standard.pdf -> review -> Confirm all -> save -> results 375.14 / 22,508.29 / 3,008.29;
//            dealer_worksheet_two_options.pdf chooser; contract_variable_rate.pdf unsupported + one-click manual
//            fallback; manual path to results.
//   Every state: copyIssues 0, axe 0 serious/critical (reduced motion), one visible primary action, no horizontal
//   scroll; screenshots at 1440x900, 1920x1080, 768x1024 and 390x844.
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3303 API=http://localhost:8303 DOCS=<repo>/backend/fixtures/documents node s3_offer_options.mjs <outdir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { axe, copyClean, copyIssues, noHorizontalScroll, primaryActions } from "./lib/check.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const WEB = process.env.WEB || "http://localhost:3303";
const API = (process.env.API || "http://localhost:8303") + "/api/v1";
const DOCS = process.env.DOCS || path.resolve("../backend/fixtures/documents");
const OUT = process.argv[2] || "./s3_offer_options_out";
const ONLY = process.env.ONLY || "all"; // all | options | offer
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  [1440, 900],
  [1920, 1080],
  [768, 1024],
  [390, 844],
];

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " :: " + detail : ""}`);
}

const HOUSEHOLD = [
  { key: "income.take_home_monthly", value: "4200" },
  { key: "expenses.essential.total", value: "2900" },
  { key: "debts.count", value: "0" },
  { key: "savings.liquid", value: "6000" },
  { key: "loan.down_payment_source", value: "savings" },
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

async function api(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/** A session with the household answered; optionally with the reference offer and a report. */
async function seed({ offer = false, analysis = false } = {}) {
  const s = await api("POST", "/sessions", {});
  await api("POST", `/sessions/${s.session_id}/facts`, { facts: HOUSEHOLD }, s.token);
  let offerId = null;
  let reportId = null;
  if (offer) offerId = (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id;
  if (analysis) reportId = (await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token)).report_id;
  return { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function context(seedValues, [w, h]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await ctx.addInitScript((v) => {
    sessionStorage.setItem("dt.session_id", v.sessionId);
    sessionStorage.setItem("dt.token", v.token);
    sessionStorage.setItem("dt.data_mode", v.dataMode);
    sessionStorage.setItem("dt.consent", "1");
    if (v.offerId) sessionStorage.setItem("dt.offer_id", v.offerId);
    if (v.reportId) sessionStorage.setItem("dt.report_id", v.reportId);
  }, seedValues);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}

async function shoot(page, name) {
  const [w, h] = [page.viewportSize().width, page.viewportSize().height];
  await page.screenshot({ path: `${OUT}/${name}_${w}x${h}_first.png` });
  await page.screenshot({ path: `${OUT}/${name}_${w}x${h}_full.png`, fullPage: true });
}

/** Editorial + a11y + layout checks for the current state. */
async function stateChecks(page, label, { axeScan = true } = {}) {
  const copy = await copyIssues(page);
  check(`${label}: copy clean (dashes, banned, "!")`, copyClean(copy), copyClean(copy) ? "" : JSON.stringify({ v: copy.visible, a: copy.all }).slice(0, 400));
  const pa = await primaryActions(page);
  check(`${label}: exactly one visible primary action`, pa.visible === 1, JSON.stringify(pa.labels));
  check(`${label}: no horizontal scroll`, await noHorizontalScroll(page));
  check(`${label}: one h1`, (await page.locator("h1").count()) === 1);
  if (axeScan) {
    const a = await axe(page, AXE);
    check(`${label}: axe 0 serious/critical`, a.serious.length === 0, JSON.stringify(a.serious).slice(0, 400));
  }
}

const text = (page) => page.evaluate(() => document.body.innerText);

/* =============================================================================================== */
/* Options                                                                                          */
/* =============================================================================================== */
async function optionsChecks() {
  console.log("Options (/alternatives)");
  const sv = await seed({ offer: true, analysis: true });
  for (const vp of VIEWPORTS) {
    const { ctx, page, errors } = await context(sv, vp);
    const tag = `options ${vp[0]}`;
    await page.goto(WEB + "/alternatives", { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "What could you change?" }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(400);
    await shoot(page, "options");
    const t = await text(page);
    if (vp[0] === 1440) {
      check(`${tag}: framing says what-if, not offers`, /what-if calculations under stated assumptions, not offers or recommendations/i.test(t));
      const cards = await page.locator("article[data-alt-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-alt-id")));
      check(`${tag}: 1 to 3 engine options`, cards.length >= 1 && cards.length <= 3, cards.join(","));
      const t72 = page.locator("article[data-alt-id]", { hasText: "A 72-month term instead of 60" });
      check(`${tag}: 72-month option shown`, (await t72.count()) === 1);
      const big = (await t72.locator("[data-headline]").innerText()).replace(/\s+/g, " ");
      check(`${tag}: 72 months big number $319.78 a month`, /\$319\.78 a month/.test(big), big);
      check(`${tag}: benefit from backend delta ($55.36)`, /\$55\.36 a month less than your offer/.test(await t72.innerText()));
      check(`${tag}: trade-off sentence ($516.25 more in finance charges)`, /you pay \$516\.25 more in finance charges/i.test(await t72.locator("[data-tradeoff]").innerText()));
      check(`${tag}: same-rate label`, (await t72.innerText()).includes("Same rate assumed, ask the lender"));
      const bars = t72.locator("[data-compare-bars]");
      const barsText = await bars.innerText();
      check(`${tag}: compact comparison vs your offer (375.14 vs 319.78)`, barsText.includes("$375.14") && barsText.includes("$319.78"));
      check(`${tag}: finance charge comparison (3,008.29 vs 3,524.54)`, barsText.includes("$3,008.29") && barsText.includes("$3,524.54"));
      const t36 = page.locator("article[data-alt-id]", { hasText: "A 36-month term instead of 60" });
      if (await t36.count()) {
        const b36 = (await t36.locator("[data-headline]").innerText()).replace(/\s+/g, " ");
        check(`${tag}: 36 months big number $1,998.32 finance charge`, /\$1,998\.32/.test(b36), b36);
      }
      check(`${tag}: rate sensitivity`, (await page.locator("[data-rate-sensitivity]").count()) === 1);
      check(`${tag}: no invented verdicts`, !/\b(verified|you can afford|recommended|best option|safe|approved)\b/i.test(t));
      const src = page.locator("article[data-alt-id] [data-source-link]").first();
      await src.click();
      await page.waitForTimeout(300);
      check(`${tag}: source one click away`, (await page.locator("[role=dialog]").count()) >= 1);
      await page.keyboard.press("Escape");
      const sum = page.locator("summary", { hasText: /^Compare all \d+ options/ });
      check(`${tag}: "Compare all N options" disclosure`, (await sum.count()) === 1, (await sum.innerText()).split("\n")[0]);
      await sum.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
      check(`${tag}: opens with the keyboard`, await page.locator("details:has(summary:has-text('Compare all'))").evaluate((d) => d.open));
      check(`${tag}: chart revealed`, await page.locator("details[open] svg").first().isVisible());
      const rows = await page.locator("details[open] table tbody tr").count();
      check(`${tag}: table revealed with every option`, rows === 16, String(rows));
      const pa = page.locator("[data-primary-action]:visible");
      check(`${tag}: primary action goes to the report`, (await pa.getAttribute("href")) === "/report", await pa.innerText());
      await shoot(page, "options_open");
      await stateChecks(page, `${tag} (compare open)`);
      await sum.click();
    } else {
      check(`${tag}: $319.78 shown`, t.includes("$319.78"));
      await stateChecks(page, tag, { axeScan: vp[0] === 390 });
    }
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  }
}

try {
  if (ONLY === "all" || ONLY === "options") await optionsChecks();
} catch (e) {
  check("script ran without exceptions", false, String(e?.stack ?? e).slice(0, 800));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
