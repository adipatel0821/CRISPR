// CP2 live browser test of the DOCUMENT UPLOAD flow: Next.js (:3000) -> FastAPI (:8000, LLM_DATA_MODE=synthetic_only).
// Usage (needs playwright-core resolvable from the script's folder + system Chrome):
//   node doc_flow.mjs <path-to-backend/fixtures/documents> [screenshot-out-dir]
// Runs three journeys in fresh browser contexts:
//   A. contract_standard.pdf  -> verification table -> confirm all -> down-payment q -> dashboard 375.14 / 22,508.29 / 3,008.29
//   B. dealer_worksheet_two_options.pdf -> offer chooser -> 60-month option -> confirm -> dashboard
//   C. contract_variable_rate.pdf -> unsupported-product message -> manual fallback
import { chromium } from "playwright-core";
import path from "node:path";

const WEB = process.env.WEB || "http://localhost:3000";
const API = process.env.API || "http://localhost:8000";
const DOCS = process.argv[2];
const OUT = process.argv[3] || ".";
if (!DOCS) {
  console.error("usage: node doc_flow.mjs <fixtures/documents dir> [out dir]");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const consoleErrors = [];

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  return page;
}

async function start(page) {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
}

// UX3: the question is the h1 (h2 when inline on /offer) of form[data-fact-key]; answer by fact key.
const VALUES = { "income.take_home_monthly": "4200", "expenses.essential.total": "2900", "debts.count": "0", "savings.liquid": "6000" };
async function answerQuestions(page, max = 12, scope = page) {
  const asked = [];
  for (let i = 0; i < max; i++) {
    const form = scope.locator("form[data-fact-key]").first();
    try { await form.waitFor({ timeout: 5000 }); } catch { break; }
    const key = await form.getAttribute("data-fact-key");
    const q = (await form.locator("h1, h2").first().textContent()).trim();
    asked.push(`${key}: ${q}`);
    if (key === "loan.down_payment_source") await form.locator("[data-option-tile]", { hasText: /savings/i }).first().click();
    else if (VALUES[key] !== undefined) await form.locator("[data-amount-input] input").first().fill(VALUES[key]);
    else { console.log("   unexpected question:", key, q); break; }
    await form.getByRole("button", { name: /^Continue$/ }).click();
    await page.waitForTimeout(600);
  }
  return asked;
}

async function openUploadTab(page) {
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  // UX3: the method is a radio tile ("Upload the contract" / "Enter the numbers"), the native radio covers the tile
  await page.getByRole("radio", { name: /Upload the contract/ }).click();
  await page.locator("[data-drop-zone]").waitFor({ timeout: 10000 });
}

async function upload(page, file) {
  await page.locator("#doc-upload").setInputFiles(path.join(DOCS, file));
}

async function confirmAllAndSave(page) {
  await page.getByRole("button", { name: /Confirm all remaining/ }).click();
  await page.getByRole("button", { name: /Save checked offer/ }).click();
  await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 15000 });
}

async function answerPendingAndRun(page, asked) {
  // UX3: a pending blocking question is asked inline on /offer ("Before your results")
  const inline = page.locator("section[aria-label='Before your results']");
  if (await inline.count()) asked.push(...(await answerQuestions(page, 4, inline)));
  const btn = page.getByRole("button", { name: /See my results/ });
  await btn.waitFor({ timeout: 10000 }).catch(() => {});
  if (!(await btn.isEnabled().catch(() => false))) {
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    asked.push(...(await answerQuestions(page, 4)));
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  }
  await page.getByRole("button", { name: /See my results/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
}

async function fetchReport(page) {
  return page.evaluate(async (api) => {
    const t = sessionStorage.getItem("dt.token");
    const r = sessionStorage.getItem("dt.report_id");
    const res = await fetch(`${api}/api/v1/reports/${r}`, { headers: { Authorization: `Bearer ${t}` } });
    return res.json();
  }, API);
}

try {
  // ---------------------------------------------------------------- A. standard contract
  console.log("A. contract_standard.pdf");
  {
    const page = await newPage();
    await start(page);
    const asked = await answerQuestions(page);
    check("A: intake asked the 4 household questions", asked.length >= 4, JSON.stringify(asked));
    await openUploadTab(page);
    await upload(page, "contract_standard.pdf");
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    for (const v of ["$375.14", "$22,508.29", "$3,008.29", "$19,500.00", "$20,000.00"]) check(`A: verification table shows ${v}`, t.includes(v));
    // UX3 copy: the page suffix is ", page 1" (no dash); same quote, same page
    check("A: verbatim quote shown with page", /“FINANCE CHARGE The dollar amount the credit will cost you\. \$3,008\.29”, page 1/.test(t), t.slice(0, 300));
    check("A: check results shown (quote match / APR recompute passed)", /passed/.test(t) && /APR/i.test(t));
    check("A: chips say 'From your document', never 'verified'", /From your document, p\.1/.test(t) && !/\bverified\b/i.test(t));
    await page.screenshot({ path: `${OUT}/doc_A_verify.png`, fullPage: true });
    await confirmAllAndSave(page);
    const summary = await page.textContent("main");
    check("A: saved offer summary shows confirmed document values", /375\.14/.test(summary) && !/\bverified\b/i.test(summary));
    await answerPendingAndRun(page, asked);
    check("A: down-payment source question asked", asked.some((q) => /down.payment/i.test(q)), JSON.stringify(asked));
    const dash = await page.textContent("body");
    for (const v of ["375.14", "22,508.29", "3,008.29"]) check(`A: dashboard shows ${v}`, dash.includes(v));
    check("A: dashboard shows a document-sourced evidence label", /From your document, p\.1/.test(dash));
    check("A: no 'verified' wording on dashboard", !/\bverified\b/i.test(dash));
    check("A: assumption chip shown for metrics that depend on an assumption", /Includes an assumption|Estimate/.test(dash));
    const report = await fetchReport(page);
    console.log("   report derived_status:", report.with_offer?.derived_status, "assumptions_used:", JSON.stringify(report.with_offer?.assumptions_used));
    const docEv = (report.evidence || []).filter((e) => e.kind === "document");
    check("A: report carries document evidence", docEv.length > 0, String(docEv.length));
    // popover on Monthly payment lists the document quote
    await page.getByRole("button", { name: /Source for Monthly payment/ }).click();
    const pop = await page.locator("[data-radix-popper-content-wrapper]").first().textContent().catch(() => "");
    check("A: monthly payment source popover lists the document quote", /From your document/.test(pop) && /page 1/.test(pop), pop.slice(0, 200));
    await page.keyboard.press("Escape");
    await page.screenshot({ path: `${OUT}/doc_A_dashboard.png`, fullPage: true });
    await page.context().close();
  }

  // ---------------------------------------------------------------- B. two-option worksheet
  console.log("B. dealer_worksheet_two_options.pdf");
  {
    const page = await newPage();
    await start(page);
    const asked = await answerQuestions(page);
    await openUploadTab(page);
    await upload(page, "dealer_worksheet_two_options.pdf");
    const legend = page.getByText(/This document has 2 offers/);
    await legend.waitFor({ timeout: 20000 });
    check("B: offer chooser shown", true);
    await page.getByRole("radio", { name: /60 MONTHS/ }).check();
    await page.getByRole("button", { name: /Use this offer/ }).click();
    await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
    const t = await page.locator("section[aria-labelledby=verify-heading]").textContent();
    check("B: chosen option values shown (375.14, 60 months)", t.includes("$375.14") && /60 months/.test(t) && !t.includes("319.78"), t.slice(0, 300));
    await page.screenshot({ path: `${OUT}/doc_B_verify.png`, fullPage: true });
    await confirmAllAndSave(page);
    await answerPendingAndRun(page, asked);
    const dash = await page.textContent("body");
    for (const v of ["375.14", "22,508.29", "3,008.29"]) check(`B: dashboard shows ${v}`, dash.includes(v));
    check("B: dashboard labelled with the chosen option", /OPTION A - 60 MONTHS/.test(dash));
    check("B: no 'verified' wording on dashboard", !/\bverified\b/i.test(dash));
    await page.screenshot({ path: `${OUT}/doc_B_dashboard.png`, fullPage: true });
    await page.context().close();
  }

  // ---------------------------------------------------------------- C. variable-rate (unsupported)
  console.log("C. contract_variable_rate.pdf");
  {
    const page = await newPage();
    await start(page);
    await answerQuestions(page);
    await openUploadTab(page);
    await upload(page, "contract_variable_rate.pdf");
    const alert = page.getByRole("alert").filter({ hasText: /isn't supported/ });
    await alert.waitFor({ timeout: 20000 });
    const at = await alert.textContent();
    check("C: unsupported-product message shown", /variable rate/i.test(at) && /fixed-rate/i.test(at), at);
    check("C: exactly one unsupported alert (no duplicate)", (await page.getByRole("alert").filter({ hasText: /support/i }).count()) === 1);
    check("C: terms shown for reference only", await page.getByRole("heading", { name: /for reference only/ }).isVisible());
    check("C: no save / See-my-results path for an unsupported offer",
      (await page.getByRole("button", { name: /See my results|Save checked offer|Confirm all/ }).count()) === 0);
    await page.screenshot({ path: `${OUT}/doc_C_unsupported.png`, fullPage: true });
    await alert.getByRole("button", { name: /Enter the numbers instead/ }).click();
    await page.getByLabel("Cash price of the car", { exact: true }).waitFor({ timeout: 5000 });
    check("C: manual fallback opens the manual form", await page.getByLabel("Cash price of the car", { exact: true }).isVisible());
    await page.context().close();
  }
} catch (e) {
  check("document walkthrough completed without exception", false, String(e).slice(0, 500));
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
