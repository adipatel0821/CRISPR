// Screen agent A — live E2E for Welcome / Intake / Offer on :3000 -> :8000. Usage: node ux_a_flow.mjs [only]
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = "http://localhost:3000";
const OUT = path.join(HERE, "ux_a");
const DOCS = process.env.DOCS || new URL("../../backend/fixtures/documents", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const AXE = path.join(HERE, "node_modules/axe-core/axe.min.js");
const ONLY = process.argv[2] || "all";
const SKIP_DOWN = process.env.SKIP_DOWN === "1";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " — " + detail : ""}`);
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const consoleErrors = [];

async function newPage(width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function axe(page, label) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  const serious = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  for (const v of r) console.log(`     - axe ${label} [${v.impact}] ${v.id} x${v.n} :: ${v.targets.join(" | ")}`);
  check(`axe ${label}: 0 serious/critical`, serious.length === 0, serious.map((v) => v.id).join(","));
}
async function overflow(page, label) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${label}: no horizontal scroll`, o <= 0, `${o}px`);
}

async function start(page, shots = false) {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  if (shots) await shot(page, `welcome_${page.viewportSize().width}`);
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
}

async function answerQuestions(page, max = 12, shotPrefix = null) {
  const asked = [];
  for (let i = 0; i < max; i++) {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    try { await cont.waitFor({ timeout: 5000 }); } catch { break; }
    const q = (await page.locator("main h2").first().textContent()).trim();
    asked.push(q);
    if (shotPrefix && i === 0) await shot(page, `${shotPrefix}_q1`);
    if (/take-home/i.test(q)) await page.getByLabel(q).fill("4200");
    else if (/essential/i.test(q)) await page.getByLabel(q).fill("2900");
    else if (/debt/i.test(q)) await page.getByLabel(q).fill("0");
    else if (/savings/i.test(q) && !/down payment/i.test(q)) await page.getByLabel(q).fill("6000");
    else if (/down payment/i.test(q) && SKIP_DOWN) { await page.getByRole("button", { name: "Skip for now" }).click(); await page.waitForTimeout(600); continue; }
    else if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click();
    else { console.log("   unexpected question:", q); break; }
    if (shotPrefix && i === 2) await shot(page, `${shotPrefix}_q3`);
    await cont.click();
    await page.waitForTimeout(600);
  }
  return asked;
}

async function answerPendingInline(page, asked) {
  for (let i = 0; i < 3; i++) {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    if (!(await cont.count())) break;
    const q = (await page.locator("main section[aria-label='Before your results'] h2").first().textContent()).trim();
    asked.push(q);
    if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click();
    else break;
    await cont.click();
    await page.waitForTimeout(900);
  }
}

async function runAndCheck(page, tag) {
  const btn = page.getByRole("button", { name: /See my results/ });
  check(`${tag}: See my results enabled`, await btn.isEnabled());
  await btn.click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(2500);
  const dash = await page.textContent("body");
  for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29"]) check(`${tag}: dashboard shows ${v}`, dash.includes(v));
  check(`${tag}: savings 6,000 -> 2,000 present`, dash.includes("6,000") && dash.includes("2,000"));
}

try {
  if (ONLY === "all" || ONLY === "manual") {
    console.log("MANUAL");
    const page = await newPage();
    await start(page, true);
    await axe(page, "/intake q1");
    const asked = await answerQuestions(page, 12, "intake_1280");
    check("manual: 4 household questions asked", asked.length >= 4, JSON.stringify(asked));
    await page.getByRole("heading", { name: /That's everything we need/ }).waitFor({ timeout: 8000 });
    await page.locator("summary", { hasText: "Your answers (" }).click(); await page.waitForTimeout(500);
    await page.waitForTimeout(300);
    await shot(page, "intake_done_1280");
    check("manual: answers disclosure has status chips", /You told us/.test(await page.textContent("main")));
    await axe(page, "/intake done");
    // edit flow
    await page.getByRole("button", { name: /Edit Savings you could use/ }).click();
    await page.locator("#edit-savings\\.liquid").fill("6000");
    await page.getByRole("button", { name: /^Save$/ }).click();
    await page.waitForTimeout(1000);
    check("manual: edit saved (status updated)", /Updated: Savings you could use/.test(await page.textContent("main")));

    await page.getByRole("link", { name: /Continue to the loan offer/ }).click();
    await page.waitForURL(/\/offer/);
    await page.getByLabel("Cash price of the car", { exact: true }).waitFor();
    await shot(page, "offer_form_1280");
    await axe(page, "/offer form");
    await page.locator("summary", { hasText: "More details" }).click(); await page.waitForTimeout(500);
    const fields = {
      "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
      "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
      "APR": "5.796", "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14",
    };
    for (const [label, v] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(v);
    await shot(page, "offer_form_filled_1280");
    await page.locator("#offer-confirm").click();
    await page.getByRole("button", { name: /Save offer/ }).click();
    await page.getByRole("heading", { name: "Your loan offer" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await shot(page, "offer_saved_1280");
    await answerPendingInline(page, asked);
    check("manual: down payment asked", asked.some((q) => /down payment/i.test(q)), JSON.stringify(asked));
    await page.waitForTimeout(600);
    await shot(page, "offer_ready_1280");
    await axe(page, "/offer ready");
    await runAndCheck(page, "manual");
    await shot(page, "manual_dashboard_1280");
    // back to intake: done state now shows See my results
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    check("intake done with offer: primary is See my results", await page.getByRole("button", { name: /See my results/ }).count() === 1);
    check("intake: running-costs not-included note", /running costs \(insurance, fuel, maintenance\) aren.t included/.test(await page.textContent("main")));
    await shot(page, "intake_done_with_offer_1280");
    await page.context().close();
  }

  if (ONLY === "all" || ONLY === "pending") {
    console.log("PENDING: offer added before intake is finished");
    const page = await newPage();
    await start(page);
    const asked = await answerQuestions(page, 3);
    await page.getByRole("link", { name: "Add it now" }).click();
    await page.waitForURL(/\/offer/);
    await page.locator("summary", { hasText: "More details" }).click();
    const fields = {
      "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
      "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
      "APR": "5.796", "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14",
    };
    for (const [label, v] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(v);
    await page.getByRole("button", { name: /Save offer/ }).click();
    check("pending: confirmation required message", /Please confirm the values match your offer/.test(await page.textContent("main")));
    await page.locator("#offer-confirm").click();
    await page.getByRole("button", { name: /Save offer/ }).click();
    await page.getByRole("heading", { name: "Your loan offer" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    const sec = page.locator("section[aria-label='Before your results']");
    check("pending: open question shown inline on the offer step", (await sec.count()) === 1);
    check("pending: See my results disabled while pending", !(await page.getByRole("button", { name: /See my results/ }).isEnabled()));
    await shot(page, "offer_saved_pending_1280");
    await axe(page, "/offer pending");
    for (let i = 0; i < 4 && (await sec.count()); i++) {
      const q = (await sec.locator("h2").first().textContent()).trim();
      asked.push(q);
      if (/savings/i.test(q) && !/down payment/i.test(q)) await page.getByLabel(q).fill("6000");
      else if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click();
      else break;
      await page.getByRole("button", { name: /^Continue$/ }).click();
      await page.waitForTimeout(1200);
    }
    console.log("   asked:", JSON.stringify(asked));
    await runAndCheck(page, "pending");
    await page.context().close();
  }

  if (ONLY === "all" || ONLY === "mobile") {
    console.log("MOBILE 390 / 360");
    const page = await newPage(390);
    await start(page, true);
    await overflow(page, "390 /intake");
    await answerQuestions(page, 12, "intake_390");
    await page.locator("summary", { hasText: "Your answers (" }).click(); await page.waitForTimeout(500);
    await shot(page, "intake_done_390");
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await page.getByLabel("Cash price of the car", { exact: true }).waitFor();
    await shot(page, "offer_form_390");
    await page.getByRole("tab", { name: "Upload contract" }).click();
    await shot(page, "offer_upload_390");
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "contract_standard.pdf"));
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    await shot(page, "offer_verify_390");
    await page.setViewportSize({ width: 360, height: 800 });
    await overflow(page, "360 /offer verify");
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await overflow(page, "360 /");
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    await overflow(page, "360 /intake");
    await page.context().close();
  }

  if (ONLY === "all" || ONLY === "docA") {
    console.log("DOC A contract_standard.pdf");
    const page = await newPage();
    await start(page);
    const asked = await answerQuestions(page);
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Upload contract" }).click();
    await shot(page, "offer_upload_1280");
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "contract_standard.pdf"));
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    for (const v of ["$375.14", "$22,508.29", "$3,008.29", "$19,500.00", "$20,000.00"]) check(`A: verification shows ${v}`, t.includes(v));
    check("A: verbatim quote with page (behind Show evidence)", /“FINANCE CHARGE The dollar amount the credit will cost you\. \$3,008\.29” — page 1/.test(t));
    check("A: 'From your document, p.1' and never 'verified'", /From your document, p\.1/.test(t) && !/\bverified\b/i.test(t));
    await page.locator("[data-term=finance_charge] summary", { hasText: "Show evidence" }).click(); await page.waitForTimeout(500);
    await shot(page, "offer_verify_1280");
    await axe(page, "/offer verify");
    await page.getByRole("button", { name: /Confirm all remaining/ }).click();
    await shot(page, "offer_verify_confirmed_1280");
    await page.getByRole("button", { name: /Save checked offer/ }).click();
    await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000);
    await shot(page, "docA_saved_1280");
    await answerPendingInline(page, asked);
    await runAndCheck(page, "A");
    await page.context().close();
  }

  if (ONLY === "all" || ONLY === "docB") {
    console.log("DOC B dealer_worksheet_two_options.pdf");
    const page = await newPage();
    await start(page);
    const asked = await answerQuestions(page);
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Upload contract" }).click();
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "dealer_worksheet_two_options.pdf"));
    await page.getByText(/This document has 2 offers/).waitFor({ timeout: 20000 });
    await shot(page, "docB_chooser_1280");
    await axe(page, "/offer chooser");
    await page.getByRole("radio", { name: /60 MONTHS/ }).check();
    await page.getByRole("button", { name: /Use this offer/ }).click();
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    check("B: chosen option values shown", t.includes("$375.14") && /60 months/.test(t) && !t.includes("319.78"));
    await page.getByRole("button", { name: /Confirm all remaining/ }).click();
    await page.getByRole("button", { name: /Save checked offer/ }).click();
    await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 15000 });
    await answerPendingInline(page, asked);
    await runAndCheck(page, "B");
    await page.context().close();
  }

  if (ONLY === "all" || ONLY === "docC") {
    console.log("DOC C contract_variable_rate.pdf");
    const page = await newPage();
    await start(page);
    await answerQuestions(page);
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Upload contract" }).click();
    await page.locator("#doc-upload").setInputFiles(path.join(DOCS, "contract_variable_rate.pdf"));
    const alert = page.getByRole("alert").filter({ hasText: /isn't supported/ });
    await alert.waitFor({ timeout: 20000 });
    check("C: unsupported message names variable rate + fixed-rate", /variable rate/i.test(await alert.textContent()) && /fixed-rate/i.test(await alert.textContent()));
    check("C: exactly one unsupported alert", (await page.getByRole("alert").filter({ hasText: /support/i }).count()) === 1);
    check("C: no save path", (await page.getByRole("button", { name: /See my results|Save checked offer|Confirm all/ }).count()) === 0);
    await shot(page, "docC_unsupported_1280");
    await axe(page, "/offer unsupported");
    await alert.getByRole("button", { name: /Type the terms instead/ }).click();
    check("C: manual fallback", await page.getByLabel("Cash price of the car", { exact: true }).isVisible());
    await page.context().close();
  }
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 600));
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
