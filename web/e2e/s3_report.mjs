// UX3 report check: the decision report through the real API. Reference figures on screen and in the appendix,
// the appendix collapsed and keyboard operable, print/PDF (summary only: <= 2 Letter pages; with the appendix when
// chosen), copy checks on screen and in the PDF text, axe, one primary action, no sideways scroll, delete
// confirmation, a refined session (running costs known), and screenshots at four viewports.
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome; PyMuPDF for PDF text):
//   WEB=http://localhost:3304 API=http://localhost:8304 OUT=./out PY=path/to/python node s3_report.mjs
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { axe, copyClean, copyIssues, noHorizontalScroll, primaryActions } from "./lib/check.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const WEB = process.env.WEB || "http://localhost:3304";
const API = (process.env.API || "http://localhost:8304") + "/api/v1";
const OUT = process.env.OUT || "./s3_report_out";
const PY = process.env.PY || "P:/Projects/DecisionTwin/backend/.venv/Scripts/python.exe";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? "  (" + detail + ")" : ""}`);
};

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

async function api(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

async function prepare(facts) {
  const s = await api("POST", "/sessions", {});
  await api("POST", `/sessions/${s.session_id}/facts`, { facts }, s.token);
  const offerId = (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id;
  const reportId = (await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token)).report_id;
  return { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId };
}

async function context(browser, sess, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await ctx.addInitScript((v) => {
    sessionStorage.setItem("dt.session_id", v.sessionId);
    sessionStorage.setItem("dt.token", v.token);
    sessionStorage.setItem("dt.data_mode", v.dataMode);
    sessionStorage.setItem("dt.consent", "1");
    sessionStorage.setItem("dt.offer_id", v.offerId);
    sessionStorage.setItem("dt.report_id", v.reportId);
  }, sess);
  return ctx;
}

async function openReport(page) {
  await page.goto(WEB + "/report", { waitUntil: "networkidle" });
  await page.locator("h1#report-title").waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
}

function pdfText(file) {
  const out = execFileSync(PY, ["-I", "-c", "import fitz,sys,json; d=fitz.open(sys.argv[1]); print(json.dumps({'pages': d.page_count, 'text': '\\f'.join(p.get_text() for p in d)}))", file], { encoding: "utf8" });
  return JSON.parse(out);
}

function textIssues(s) {
  const dashes = [...s.matchAll(/[\u2013\u2014]/g)].length;
  const bang = [...s.matchAll(/[A-Za-z0-9)]!/g)].length;
  return { dashes, bang };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const consoleErrors = [];
try {
  const sess = await prepare(HOUSEHOLD);
  check("session prepared through the real API", !!sess.reportId);

  // ---------------- 1440: values, structure, appendix, keyboard, print ----------------
  {
    const ctx = await context(browser, sess, 1440, 900);
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));
    await openReport(page);
    const main = await page.textContent("main");
    for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "1,300.00", "924.86", "6,000.00", "2,000.00", "2.07", "0.61", "19,500.00", "5.796%"]) {
      check(`report shows ${v}`, main.includes(v));
    }
    check("one h1", (await page.locator("h1").count()) === 1);
    check("h1 names the loan", /Financing a \$22,000 car over 60 months/.test(await page.locator("h1").textContent()));
    check("running costs limitation visible", await page.locator("[data-running-costs-missing]").isVisible());
    check("no banned words", !/\b(verified|you can afford|recommended|best option|safe)\b/i.test(main));
    for (const h of ["The loan you are weighing", "What changes for you", "Main concern", "Options worth a look", "Before you sign", "About this report", "Appendix"]) {
      check(`section "${h}"`, (await page.getByRole("heading", { level: 2, name: h }).count()) === 1);
    }
    // main concern: the with-loan income shock (savings run out in month 2, shortfall 3,625.42)
    const concern = await page.locator("[data-report-section=concerns]").textContent();
    check("main concern names the shortfall 3,625.42", concern.includes("3,625.42"), concern.slice(0, 160));
    check("main concern says month 2", /month 2\b/i.test(concern));
    const figs = await page.locator("[data-concern-figures]").textContent().catch(() => "");
    check("main concern figures: savings run out in Month 2, shortfall $3,625.42", /Savings run out\s*Month 2/.test(figs) && figs.includes("$3,625.42"), figs);
    check("main concern is labelled illustrative", /Illustrative scenario, not a prediction/.test(concern));
    const disclaimers = await page.locator("[data-report-section=about]").textContent();
    check("disclaimers shown once", (main.match(/not financial advice/gi) || []).length <= 1, String((main.match(/not financial advice/gi) || []).length));
    check("data mode stated", /synthetic/i.test(disclaimers));
    const pa = await primaryActions(page);
    check("exactly one primary action, visible", pa.total === 1 && pa.visible === 1, JSON.stringify(pa));
    check("primary action is Print or save as PDF", /Print or save as PDF/.test(await page.locator("[data-primary-action]").textContent()));
    check("no horizontal scroll at 1440", await noHorizontalScroll(page));

    for (const sec of ["loan", "changes", "concerns", "alternatives"]) {
      check(`section ${sec} has a one-click source`, (await page.locator(`[data-report-section=${sec}] [data-source-link]`).count()) >= 1);
    }
    // source: one click opens the provenance popover
    await page.locator("[data-report-section=loan] [data-source-link]").first().click();
    await page.waitForTimeout(300);
    check("source popover opens in one click", (await page.locator("[data-radix-popper-content-wrapper]").count()) > 0);
    await page.keyboard.press("Escape");

    // appendix collapsed on screen; keyboard opens it
    const appBtn = page.getByRole("button", { name: "Show appendix" });
    check("appendix collapsed on screen", (await appBtn.getAttribute("aria-expanded")) === "false" && !(await page.locator("#appendix-body").isVisible()));
    const ax1 = await axe(page, AXE);
    check("axe /report (collapsed): 0 serious/critical", ax1.serious.length === 0, JSON.stringify(ax1.serious.map((v) => v.id)));
    const ci1 = await copyIssues(page);
    check("copy: no dashes, banned phrases or ! (collapsed)", copyClean(ci1), JSON.stringify(ci1).slice(0, 300));
    await page.screenshot({ path: `${OUT}/report_1440_full.png`, fullPage: true });

    // keyboard: Tab reaches the primary action
    await page.locator("body").focus();
    let reached = false;
    for (let i = 0; i < 40 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => !!document.activeElement?.closest("[data-primary-action]"));
    }
    check("keyboard: Tab reaches Print or save as PDF", reached);

    // print, summary only
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(300);
    check("print: appendix hidden by default", !(await page.locator("#appendix").isVisible()));
    check("print: primary action hidden", !(await page.locator("[data-primary-action]").isVisible()));
    check("print: site header hidden", !(await page.locator("header[data-site-header]").isVisible()));
    check("print: rail hidden", !(await page.locator("aside[data-stage-rail]").isVisible()));
    await page.pdf({ path: `${OUT}/report_summary.pdf`, format: "Letter", printBackground: false });
    const p1 = pdfText(`${OUT}/report_summary.pdf`);
    writeFileSync(`${OUT}/report_summary.txt`, p1.text);
    check("PDF summary is 1 to 2 Letter pages", p1.pages >= 1 && p1.pages <= 2, `${p1.pages} pages`);
    for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "1,300.00", "924.86", "6,000.00", "2,000.00", "3,625.42"]) {
      check(`PDF summary shows ${v}`, p1.text.includes(v));
    }
    check("PDF summary has no appendix", !/Payment schedule summary/.test(p1.text));
    check("PDF summary states running costs not included", /running costs not included/i.test(p1.text));
    const t1 = textIssues(p1.text);
    check("PDF summary text: no dashes or !", t1.dashes === 0 && t1.bang === 0, JSON.stringify(t1));
    await page.emulateMedia({ media: "screen" });

    // choose the appendix (keyboard: Space on the checkbox), print again
    await page.locator("[data-include-appendix]").focus();
    await page.keyboard.press("Space");
    check("include appendix checkbox toggles by keyboard", await page.locator("[data-include-appendix]").isChecked());
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(300);
    check("print: appendix visible when chosen", await page.locator("#appendix-body").isVisible());
    await page.pdf({ path: `${OUT}/report_with_appendix.pdf`, format: "Letter", printBackground: false });
    const p2 = pdfText(`${OUT}/report_with_appendix.pdf`);
    writeFileSync(`${OUT}/report_with_appendix.txt`, p2.text);
    check("PDF with appendix has more pages", p2.pages > p1.pages, `${p1.pages} -> ${p2.pages}`);
    check("PDF with appendix includes the appendix", /Payment schedule summary/.test(p2.text) && /Report id/.test(p2.text) && /Every statement/.test(p2.text));
    check("PDF appendix shows interest 2,508.29 and fees 500.00", p2.text.includes("2,508.29") && p2.text.includes("500.00"));
    const t2 = textIssues(p2.text);
    check("PDF with appendix text: no dashes or !", t2.dashes === 0 && t2.bang === 0, JSON.stringify(t2));
    // summary starts on page 1, appendix on its own page
    const firstApxPage = p2.text.split("\f").findIndex((pg) => /^\s*Appendix\b/m.test(pg) && /Calculation details/.test(pg));
    check("appendix starts on a new page", firstApxPage >= 1, `page index ${firstApxPage}`);
    for (let i = 0; i < Math.min(p2.pages, 4); i++) { /* page images are produced by the print screenshots below */ }
    await page.setViewportSize({ width: 816, height: 1056 });
    await page.screenshot({ path: `${OUT}/report_print_emulated.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ media: "screen" });

    // open the appendix with the keyboard
    await appBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    check("appendix opens via keyboard (aria-expanded=true)", (await page.getByRole("button", { name: "Hide appendix" }).getAttribute("aria-expanded")) === "true");
    const apx = await page.textContent("#appendix-body");
    check("appendix has amortization, ids and statements", /Payment schedule summary/.test(apx) && /Report id/.test(apx) && /Every statement/.test(apx));
    check("appendix shows interest 2,508.29", apx.includes("2,508.29"));
    const ax2 = await axe(page, AXE);
    check("axe /report (appendix open): 0 serious/critical", ax2.serious.length === 0, JSON.stringify(ax2.serious.map((v) => v.id)));
    const ci2 = await copyIssues(page);
    check("copy: no dashes, banned phrases or ! (appendix open)", copyClean(ci2), JSON.stringify(ci2).slice(0, 300));
    await page.screenshot({ path: `${OUT}/report_1440_appendix_open.png`, fullPage: true });

    // delete asks for confirmation (cancelled)
    await page.locator("footer").getByRole("button", { name: /Delete my data/ }).click();
    check("delete asks for confirmation", (await page.getByRole("alertdialog").count()) === 1);
    await page.getByRole("button", { name: "Cancel" }).click();
    await ctx.close();
  }

  // ---------------- viewports: screenshots, scroll, primary action, axe ----------------
  for (const [w, h] of [[1440, 900], [1920, 1080], [768, 1024], [390, 844]]) {
    const ctx = await context(browser, sess, w, h);
    const page = await ctx.newPage();
    await openReport(page);
    await page.screenshot({ path: `${OUT}/report_${w}x${h}_fold.png` });
    await page.screenshot({ path: `${OUT}/report_${w}x${h}_full.png`, fullPage: true });
    check(`${w}: no horizontal scroll`, await noHorizontalScroll(page));
    const pa = await primaryActions(page);
    check(`${w}: one visible primary action`, pa.visible === 1, JSON.stringify(pa));
    if (w === 390 || w === 768) {
      const ax = await axe(page, AXE);
      check(`${w}: axe 0 serious/critical`, ax.serious.length === 0, JSON.stringify(ax.serious.map((v) => v.id)));
      const ci = await copyIssues(page);
      check(`${w}: copy clean`, copyClean(ci));
    }
    await ctx.close();
  }

  // ---------------- no session: the gate's empty state ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(WEB + "/report", { waitUntil: "networkidle" });
    await page.locator("h1").first().waitFor({ timeout: 15000 });
    check("empty: one h1 'No results yet'", (await page.locator("h1").count()) === 1 && /No results yet/.test(await page.locator("h1").textContent()));
    const pa = await primaryActions(page);
    check("empty: one primary action to the loan offer", pa.visible === 1 && (await page.locator("[data-primary-action]").getAttribute("href")) === "/offer", JSON.stringify(pa));
    const ax = await axe(page, AXE);
    check("empty: axe 0 serious/critical", ax.serious.length === 0, JSON.stringify(ax.serious.map((v) => v.id)));
    await page.screenshot({ path: `${OUT}/report_empty_1440.png` });
    await ctx.close();
  }

  // ---------------- refined session: running costs known ----------------
  {
    const sess2 = await prepare([...HOUSEHOLD, ...REFINEMENTS]);
    const ctx = await context(browser, sess2, 1440, 900);
    const page = await ctx.newPage();
    await openReport(page);
    const main = await page.textContent("main");
    check("refined: left each month 900.00 -> 474.86", main.includes("900.00") && main.includes("474.86"));
    check("refined: running costs caveat gone", (await page.locator("[data-running-costs-missing]").count()) === 0);
    check("refined: payment still 375.14", main.includes("375.14"));
    await page.screenshot({ path: `${OUT}/report_refined_1440_full.png`, fullPage: true });
    await ctx.close();
  }
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 500));
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
