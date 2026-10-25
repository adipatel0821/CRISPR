// UX3 foundation check: the app frame (blue band, header actions, About, menu, delete confirmation) and that the
// live summary still shows the reference figures inside the new frame, at 1440, 390 and 360 px with nothing cut off
// at the screen edge and the primary label fitting its pill (lib/check.mjs, D5-003). Sessions are prepared through
// the real API.
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3300 API=http://localhost:8300 node s3_foundation.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { clippedElements, primaryActionFit } from "./lib/check.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const WEB = process.env.WEB || "http://localhost:3300";
const API = (process.env.API || "http://localhost:8300") + "/api/v1";

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

async function seriousAxe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { resultTypes: ["violations"] });
    return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
  });
}

const s = await api("POST", "/sessions", {});
await api("POST", `/sessions/${s.session_id}/facts`, { facts: HOUSEHOLD }, s.token);
const offerId = (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id;
const reportId = (await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token)).report_id;

const browser = await chromium.launch({ channel: "chrome", headless: true });
let failures = 0;
// D5-003: documentElement.scrollWidth cannot exceed the viewport while html/body use overflow-x: clip, so the
// "no horizontal scroll" asserts below are kept for continuity only; layoutOk() is the real check.
async function layoutOk(page, where) {
  assert.deepEqual(await clippedElements(page), [], `nothing cut off at the screen edge on ${where}`);
  assert.deepEqual((await primaryActionFit(page)).problems, [], `primary action label fits on ${where}`);
}

for (const [w, h] of [[1440, 900], [390, 844], [360, 740]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await ctx.addInitScript((v) => {
    sessionStorage.setItem("dt.session_id", v.sessionId);
    sessionStorage.setItem("dt.token", v.token);
    sessionStorage.setItem("dt.data_mode", v.dataMode);
    sessionStorage.setItem("dt.consent", "1");
    sessionStorage.setItem("dt.offer_id", v.offerId);
    sessionStorage.setItem("dt.report_id", v.reportId);
  }, { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId });
  const page = await ctx.newPage();
  try {
    // Frame: header band with wordmark, How it works, menu.
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    assert.equal(await page.locator("header[data-site-header]").count(), 1);
    assert.equal(await page.locator("[data-app-surface]").count(), 1);
    const bandBg = await page.locator("header[data-site-header]").evaluate((el) => getComputedStyle(el).backgroundColor);
    // Owner palette change (2026-10-25): the frame band is black (--color-frame #111111); blue is the accent only.
    if (w < 1024) assert.equal(bandBg, "rgb(17, 17, 17)");
    assert.equal(await page.locator("[data-primary-action]:visible").count(), 1, "one primary action on welcome");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no horizontal scroll");
    await layoutOk(page, "welcome");
    assert.deepEqual(await seriousAxe(page), [], "axe serious/critical on welcome");

    // How it works opens About with the disclaimer, and closes with Escape.
    await page.getByRole("button", { name: "How it works" }).click();
    await page.locator("[data-about]").waitFor();
    assert.match(await page.locator("[data-disclaimer]").innerText(), /not predictions or financial advice/);
    await page.keyboard.press("Escape");
    await page.locator("[data-about]").waitFor({ state: "detached" });

    // Menu: Start over and Delete my data (confirmation opens, Cancel keeps the data).
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("menuitem", { name: "Start over" }).waitFor();
    await page.getByRole("menuitem", { name: "Delete my data" }).click();
    await page.getByRole("alertdialog").waitFor();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Summary inside the new frame still shows the reference figures (backend values).
    await page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.innerText.includes("924.86"), null, { timeout: 20000 });
    const text = await page.locator("main").innerText();
    for (const fig of ["924.86", "1,300.00"]) assert.ok(text.includes(fig), `summary shows ${fig}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "no horizontal scroll on summary");
    await layoutOk(page, "summary");
    console.log(`PASS ${w}px frame, About, menu, delete confirmation, summary figures 924.86 / 1,300.00, nothing cut off, primary label fits`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${w}px ${e.message}`);
  } finally {
    await ctx.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
