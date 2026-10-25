// UX3 screen agent C: Options (/alternatives) and Loan offer (/offer) through the real API.
//
//   Options: seeded reference session -> 72 months at $319.78 a month, "Same rate assumed, ask the lender", compare-all
//            reveals the chart and the table, rate sensitivity, one yellow primary action to the report.
//   Offer:   upload contract_standard.pdf -> review -> Confirm all -> save -> results 375.14 / 22,508.29 / 3,008.29;
//            dealer_worksheet_two_options.pdf chooser; contract_variable_rate.pdf unsupported + one-click manual
//            fallback; manual path to results.
//   Every state: copyIssues 0, axe 0 serious/critical (reduced motion), one visible primary action, nothing cut off
//   at the screen edge (element bounds with every <details> open) and the primary label fits its pill (D5-003);
//   screenshots at 1440x900, 1920x1080, 768x1024, 390x844 and 360x740 (the pending question too at 390 and 360).
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3303 API=http://localhost:8303 DOCS=<repo>/backend/fixtures/documents node s3_offer_options.mjs <outdir>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { axe, clippedElements, copyClean, copyIssues, noHorizontalScroll, primaryActionFit, primaryActions } from "./lib/check.mjs";

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
  [360, 740],
];
const PHONES = VIEWPORTS.filter(([w]) => w < 768);

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
  // D5-003: the scrollWidth check above cannot fail under overflow-x: clip; these two can.
  const clipped = await clippedElements(page);
  check(`${label}: nothing cut off at the screen edge (element bounds, details open)`, clipped.length === 0, clipped.slice(0, 4).join(" | "));
  const fit = await primaryActionFit(page);
  check(`${label}: primary action label fits, no overlap`, fit.problems.length === 0, fit.problems.join(" | "));
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

/* =============================================================================================== */
/* Loan offer                                                                                       */
/* =============================================================================================== */

/** Screenshot the current state at every viewport (same page), then return to 1440x900. */
async function shootAll(page, name, label, { checks = true } = {}) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.waitForTimeout(250);
    await shoot(page, name);
    if (checks) await stateChecks(page, `${label} ${vp[0]}`, { axeScan: vp[0] === 1440 || vp[0] === 390 });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function reportFigures(page) {
  return page.evaluate(async (api) => {
    const t = sessionStorage.getItem("dt.token");
    const r = sessionStorage.getItem("dt.report_id");
    const res = await fetch(`${api}/reports/${r}`, { headers: { Authorization: `Bearer ${t}` } });
    const j = await res.json();
    const m = j.with_offer?.metrics ?? {};
    return {
      pay: m.monthly_payment?.value,
      tot: m.total_of_payments?.value,
      fc: m.finance_charge?.value,
      deal: m.total_paid_through_deal?.value,
      label: j.offer?.label,
    };
  }, API);
}

async function runToResults(page, tag) {
  const run = page.getByRole("button", { name: /See my results/ });
  await run.waitFor({ timeout: 15000 });
  check(`${tag}: See my results enabled`, await run.isEnabled());
  await run.click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const body = await page.textContent("body");
  for (const v of ["375.14", "22,508.29", "3,008.29"]) check(`${tag}: results show ${v}`, body.includes(v));
  const f = await reportFigures(page);
  check(
    `${tag}: report figures 375.14 / 22508.29 / 3008.29 / 26508.29`,
    f.pay === "375.14" && f.tot === "22508.29" && f.fc === "3008.29" && f.deal === "26508.29",
    JSON.stringify(f),
  );
  return f;
}

/** An offer saved before the down-payment question was answered: the open question shows inline on the offer step. */
async function pendingChecks() {
  const s = await api("POST", "/sessions", {});
  await api("POST", `/sessions/${s.session_id}/facts`, { facts: HOUSEHOLD.filter((f) => f.key !== "loan.down_payment_source") }, s.token);
  const offerId = (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id;
  const sv = { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId: null };
  const { ctx, page, errors } = await context(sv, [1440, 900]);
  const tag = "offer pending question";
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  await page.getByRole("heading", { level: 1, name: "Check your loan" }).waitFor({ timeout: 20000 });
  const sec = page.locator("section[aria-label='Before your results']");
  check(`${tag}: open question shown inline`, (await sec.count()) === 1);
  check(`${tag}: See my results waits for the answer`, (await page.getByRole("button", { name: /See my results/ }).count()) === 0);
  const pa = await primaryActions(page);
  check(`${tag}: one primary action (the question's Continue)`, pa.visible === 1, JSON.stringify(pa.labels));
  await shoot(page, "offer_pending");
  // phones: the bar holds Back and "Change the offer" only, the question's Continue is the one primary action
  for (const [w, h] of PHONES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    await shoot(page, "offer_pending");
    await stateChecks(page, `${tag} ${w}`, { axeScan: w === 390 });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const radio = sec.getByRole("radio", { name: /savings/i }).first();
  if (await radio.count()) {
    await radio.check({ force: true });
    await sec.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 15000 });
    check(`${tag}: answering brings back See my results`, await page.getByRole("button", { name: /See my results/ }).isEnabled());
    await stateChecks(page, `${tag} answered`);
    for (const [w, h] of PHONES) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(250);
      await stateChecks(page, `${tag} answered ${w}`, { axeScan: false });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  } else check(`${tag}: savings option present`, false);
  check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
}

async function chooseUpload(page) {
  // the transparent native radio covers its tile, so a plain click on the radio works (as in screens.mjs)
  await page.getByRole("radio", { name: /Upload the contract/ }).click();
  await page.locator("[data-drop-zone]").waitFor({ timeout: 5000 });
  check("upload tile selected by click", await page.getByRole("radio", { name: /Upload the contract/ }).isChecked());
}

async function offerChecks() {
  console.log("Loan offer (/offer)");

  // ---- manual path: start state, validation, keyboard tiles, save, confirmation, results
  {
    const sv = await seed();
    const { ctx, page, errors } = await context(sv, [1440, 900]);
    const tag = "offer manual";
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1, name: "Add your loan offer" }).waitFor({ timeout: 20000 });
    check(`${tag}: two method tiles`, (await page.locator("[data-option-tile]").count()) === 2);
    check(`${tag}: "Enter the numbers" selected by default`, await page.getByRole("radio", { name: /Enter the numbers/ }).isChecked());
    for (const l of ["Cash price of the car", "Cash down payment", "APR", "Term (months)", "Monthly payment on the contract"])
      check(`${tag}: required field visible: ${l}`, await page.getByLabel(l, { exact: true }).isVisible());
    check(`${tag}: advanced terms behind "More details"`, !(await page.getByLabel("Amount financed", { exact: true }).isVisible()));
    await shootAll(page, "offer_start", "offer start");

    // keyboard: arrow keys move between the tiles (native radios)
    await page.getByRole("radio", { name: /Enter the numbers/ }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    check(`${tag}: arrow key selects "Upload the contract"`, await page.getByRole("radio", { name: /Upload the contract/ }).isChecked());
    check(`${tag}: upload panel shown`, await page.locator("[data-drop-zone]").isVisible());
    await shootAll(page, "offer_upload", "offer upload start");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    check(`${tag}: arrow key back to the form`, await page.getByLabel("Cash price of the car", { exact: true }).isVisible());

    // validation next to the field
    await page.getByLabel("APR", { exact: true }).fill("abc");
    await page.getByRole("button", { name: /Save offer/ }).click();
    await page.waitForTimeout(300);
    check(`${tag}: field error next to APR`, (await page.locator("#term-apr-err").innerText()).includes("Enter a percentage like 4.75."));
    check(`${tag}: APR marked invalid`, (await page.getByLabel("APR", { exact: true }).getAttribute("aria-invalid")) === "true");
    await shoot(page, "offer_validation");

    const more = page.locator("summary", { hasText: "More details" });
    await more.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    check(`${tag}: More details opens with the keyboard`, await page.getByLabel("Amount financed", { exact: true }).isVisible());
    const fields = {
      "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
      "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
      APR: "5.796", "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14",
    };
    for (const [l, v] of Object.entries(fields)) await page.getByLabel(l, { exact: true }).fill(v);
    await shoot(page, "offer_manual_filled");
    await page.getByRole("button", { name: /Save offer/ }).click();
    await page.waitForTimeout(400);
    check(`${tag}: confirmation required`, /Please confirm the values match your offer/.test(await text(page)));
    await page.locator("#offer-confirm").click();
    await page.getByRole("button", { name: /Save offer/ }).click();
    await page.getByRole("heading", { level: 1, name: "Check your loan" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    const saved = await page.locator("[data-saved-offer]").innerText();
    check(`${tag}: confirmation shows payment $375.14`, saved.includes("$375.14"));
    check(`${tag}: key terms (amount financed, term, APR)`, saved.includes("$19,500.00") && /60 months/.test(saved) && /5\.796\s*%/.test(saved), saved.slice(0, 300));
    check(`${tag}: "Review all terms" disclosure`, (await page.locator("summary", { hasText: "Review all terms" }).count()) === 1);
    const railT = await page.locator("[data-stage-rail]").first().innerText();
    check(`${tag}: rail shows the loan`, railT.includes("$375.14"));
    await shootAll(page, "offer_saved", "offer saved");
    await page.locator("summary", { hasText: "Review all terms" }).click();
    await page.waitForTimeout(300);
    const all = await page.locator("[data-saved-offer] details").innerText();
    check(`${tag}: review lists principal and finance terms`, all.includes("$20,000.00") && all.includes("$500.00"));
    await stateChecks(page, `${tag} review open`);
    await runToResults(page, tag);
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  }

  // ---- A. standard contract: upload, review with evidence, Confirm all, save, results
  {
    const sv = await seed();
    const { ctx, page, errors } = await context(sv, [1440, 900]);
    const tag = "offer upload A";
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await chooseUpload(page);
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "contract_standard.pdf"));
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 30000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    for (const v of ["$375.14", "$22,508.29", "$3,008.29", "$19,500.00", "$20,000.00"]) check(`${tag}: review shows ${v}`, t.includes(v));
    check(`${tag}: verbatim quote with page`, /“FINANCE CHARGE The dollar amount the credit will cost you\. \$3,008\.29”, page 1/.test(t));
    check(`${tag}: checks shown`, /passed/.test(t) && /APR/i.test(t));
    check(`${tag}: chips say "From your document", never "verified"`, /From your document, p\.1/.test(t) && !/\bverified\b/i.test(t));
    await shootAll(page, "offer_review", "offer review");
    await page.getByRole("button", { name: /Confirm all remaining/ }).click();
    await page.getByRole("button", { name: /Save checked offer/ }).click();
    await page.getByRole("heading", { level: 1, name: "Check your loan" }).waitFor({ timeout: 15000 });
    const saved = await page.locator("[data-saved-offer]").innerText();
    check(`${tag}: confirmation shows document payment $375.14`, saved.includes("$375.14") && /Read from your document/.test(saved));
    await page.locator("summary", { hasText: "Review all terms" }).click();
    await page.waitForTimeout(300);
    const review = await page.locator("[data-saved-offer] details").innerText();
    check(`${tag}: Review all terms shows checks and document sources`, /Checks passed/.test(review) && /From your document, p\.1/.test(review), review.slice(0, 200));
    await shoot(page, "offer_saved_doc");
    await runToResults(page, tag);
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  }

  // ---- B. two-option worksheet: chooser
  {
    const sv = await seed();
    const { ctx, page, errors } = await context(sv, [1440, 900]);
    const tag = "offer upload B";
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await chooseUpload(page);
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "dealer_worksheet_two_options.pdf"));
    await page.getByText(/This document has 2 offers/).waitFor({ timeout: 30000 });
    check(`${tag}: chooser shown`, true);
    await shootAll(page, "offer_chooser", "offer chooser");
    await page.getByRole("radio", { name: /60 MONTHS/ }).check();
    await page.getByRole("button", { name: /Use this offer/ }).click();
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    check(`${tag}: chosen option values (375.14, 60 months)`, t.includes("$375.14") && /60 months/.test(t) && !t.includes("319.78"));
    await page.getByRole("button", { name: /Confirm all remaining/ }).click();
    await page.getByRole("button", { name: /Save checked offer/ }).click();
    const f = await runToResults(page, tag);
    check(`${tag}: report labelled with the chosen option`, /OPTION A - 60 MONTHS/.test(f.label ?? ""), f.label);
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  }

  // ---- C. variable rate: unsupported, one-click manual fallback
  {
    const sv = await seed();
    const { ctx, page, errors } = await context(sv, [1440, 900]);
    const tag = "offer upload C";
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await chooseUpload(page);
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "contract_variable_rate.pdf"));
    const alert = page.getByRole("alert").filter({ hasText: /isn't supported/ });
    await alert.waitFor({ timeout: 30000 });
    const at = await alert.textContent();
    check(`${tag}: unsupported message`, /variable rate/i.test(at) && /fixed-rate/i.test(at), at.slice(0, 200));
    check(`${tag}: exactly one unsupported alert`, (await page.getByRole("alert").filter({ hasText: /support/i }).count()) === 1);
    check(`${tag}: terms for reference only`, await page.getByRole("heading", { name: /for reference only/ }).isVisible());
    check(`${tag}: no save or results path`, (await page.getByRole("button", { name: /See my results|Save checked offer|Confirm all/ }).count()) === 0);
    await shootAll(page, "offer_unsupported", "offer unsupported");
    await alert.getByRole("button", { name: /Enter the numbers instead/ }).click();
    await page.waitForTimeout(400);
    check(`${tag}: one click opens the manual form`, await page.getByLabel("Cash price of the car", { exact: true }).isVisible());
    check(`${tag}: "Enter the numbers" now selected`, await page.getByRole("radio", { name: /Enter the numbers/ }).isChecked());
    check(`${tag}: no page errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
    await ctx.close();
  }
}

try {
  if (ONLY === "all" || ONLY === "options") await optionsChecks();
  if (ONLY === "all" || ONLY === "offer") await offerChecks();
  if (ONLY === "all" || ONLY === "offer" || ONLY === "pending") await pendingChecks();
} catch (e) {
  check("script ran without exceptions", false, String(e?.stack ?? e).slice(0, 800));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
