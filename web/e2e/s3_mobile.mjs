// UX3 phone layouts (audit directives D5-001, D5-002, D5-003) through the real API, at 390x844 and 360x740.
//
//   Every screen that uses the phone action bar: intake done (just completed, and with a skipped answer), offer with
//   a pending question, offer saved, summary, stress (every scenario tab, "Month by month" open), options and report
//   (appendix open). For each state:
//     - nothing is cut off at the screen edge (lib/check.mjs clippedElements, every <details> opened);
//     - exactly one visible primary action, its whole label fits its pill and it overlaps no other bar item
//       (lib/check.mjs primaryActionFit).
//   Stress month table (D5-001): the scroll region is no wider than its card or the screen, it scrolls sideways
//   (scrollWidth > clientWidth), and "Gap with loan" comes into view by keyboard (focus + arrow keys) and by touch.
//
// Usage (playwright-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3320 API=http://localhost:8320 node s3_mobile.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { clippedElements, primaryActionFit, primaryActions } from "./lib/check.mjs";

const WEB = process.env.WEB || "http://localhost:3320";
const API = (process.env.API || "http://localhost:8320") + "/api/v1";
const OUT = path.resolve(process.argv[2] || "s3_mobile_out");
fs.mkdirSync(OUT, { recursive: true });
const PHONES = [
  [390, 844],
  [360, 740],
];

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
const without = (key) => HOUSEHOLD.filter((f) => f.key !== key);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " :: " + detail : ""}`);
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

async function seed(facts, { offer = false, analysis = false } = {}) {
  const s = await api("POST", "/sessions", {});
  if (facts.length) await api("POST", `/sessions/${s.session_id}/facts`, { facts }, s.token);
  const offerId = offer ? (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id : null;
  const reportId = analysis ? (await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token)).report_id : null;
  return { sessionId: s.session_id, token: s.token, dataMode: s.data_mode, offerId, reportId };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const pageErrors = [];

async function open(sv, [w, h], route, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", ...extra });
  await ctx.addInitScript((v) => {
    sessionStorage.setItem("dt.session_id", v.sessionId);
    sessionStorage.setItem("dt.token", v.token);
    sessionStorage.setItem("dt.data_mode", v.dataMode);
    sessionStorage.setItem("dt.consent", "1");
    if (v.offerId) sessionStorage.setItem("dt.offer_id", v.offerId);
    if (v.reportId) sessionStorage.setItem("dt.report_id", v.reportId);
  }, sv);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.goto(WEB + route, { waitUntil: "networkidle" });
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}_${page.viewportSize().width}.png`) });

/** The D5-002 / D5-003 checks for one state. */
async function layout(page, label) {
  const pa = await primaryActions(page);
  check(`${label}: exactly one visible primary action`, pa.visible === 1, JSON.stringify(pa.labels));
  const fit = await primaryActionFit(page);
  const sizes = fit.items.map((i) => `"${i.label}" ${i.width}px (scroll ${i.scrollWidth} / client ${i.clientWidth})`).join(", ");
  check(`${label}: primary label fits its pill, no overlap`, fit.problems.length === 0, fit.problems.length ? fit.problems.join(" | ") : sizes);
  const clipped = await clippedElements(page);
  check(`${label}: nothing cut off at the screen edge (every <details> open)`, clipped.length === 0, clipped.slice(0, 5).join(" | "));
}

/** Where the month table's last header is, relative to its scroll region and the screen. */
const lastHeader = (page) =>
  page.evaluate(() => {
    const det = document.querySelector("details[data-month-table]");
    const reg = det.querySelector("[role=region]");
    const th = [...det.querySelectorAll("thead th")].pop();
    const r = th.getBoundingClientRect();
    const rr = reg.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    return {
      header: th.innerText.trim(),
      scrollLeft: Math.round(reg.scrollLeft),
      left: Math.round(r.left),
      right: Math.round(r.right),
      regionRight: Math.round(rr.right),
      inView: r.left >= rr.left - 1 && r.right <= rr.right + 1 && r.right <= vw + 1,
    };
  });

try {
  for (const vp of PHONES) {
    const w = vp[0];
    console.log(`\n${w} x ${vp[1]}`);

    // ---- intake done, just completed (the last answer given here), with an offer: See my results
    {
      const page = await open(await seed(without("loan.down_payment_source"), { offer: true }), vp, "/intake");
      await page.locator("form[data-fact-key='loan.down_payment_source']").waitFor({ timeout: 15000 });
      await page.locator("[data-option-tile]", { hasText: /savings/i }).first().click();
      await page.getByRole("button", { name: /^Continue$/ }).click();
      await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      check(`${w} intake done: celebration right after finishing`, (await page.locator("[data-cheer]").count()) === 1);
      await shot(page, "intake_done_complete");
      await layout(page, `${w} intake done`);
      await page.context().close();
    }

    // ---- intake done with a skipped answer (take-home pay skipped)
    {
      const page = await open(await seed(without("income.take_home_monthly")), vp, "/intake");
      await page.locator("form[data-fact-key='income.take_home_monthly']").waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
      await page.waitForTimeout(500);
      check(`${w} intake done, skipped: no celebration, plain line`, (await page.locator("[data-cheer]").count()) === 0 && /done for now/.test(await page.locator("[data-intake-done]").innerText()));
      await shot(page, "intake_done_skipped");
      await layout(page, `${w} intake done (skipped)`);
      await page.context().close();
    }

    // ---- offer with the down-payment question pending (the question's Continue is the primary action)
    {
      const page = await open(await seed(without("loan.down_payment_source"), { offer: true }), vp, "/offer");
      await page.locator("section[aria-label='Before your results']").waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      await shot(page, "offer_pending");
      await layout(page, `${w} offer pending`);
      await page.context().close();
    }

    // ---- offer saved: Back, Change the offer, See my results
    {
      const page = await open(await seed(HOUSEHOLD, { offer: true }), vp, "/offer");
      await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      await shot(page, "offer_saved");
      const bar = await page.locator("[data-action-row]").innerText();
      check(`${w} offer saved: bar keeps "Change the offer" readable`, /Change the offer/.test(bar), bar.replace(/\s+/g, " "));
      await layout(page, `${w} offer saved`);
      await page.context().close();
    }

    const full = await seed(HOUSEHOLD, { offer: true, analysis: true });

    // ---- summary (check only)
    {
      const page = await open(full, vp, "/dashboard");
      await page.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      await layout(page, `${w} summary`);
      await page.context().close();
    }

    // ---- stress: every scenario tab, "Month by month" open; region scroll by keyboard and by touch
    {
      const page = await open(full, vp, "/stress", { hasTouch: true });
      await page.locator("[data-stress-finding]").waitFor({ timeout: 20000 });
      const tabs = page.getByRole("tab");
      const n = await tabs.count();
      check(`${w} stress: scenario tabs`, n >= 2, String(n));
      for (let i = 0; i < n; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(250);
        const label = `${w} stress tab ${i + 1}`;
        const month = page.locator("details[data-month-table]");
        if (!(await month.count())) {
          await layout(page, `${label} (no table: limitation)`);
          continue;
        }
        if (!(await month.evaluate((d) => d.open))) await month.locator("> summary").click();
        await page.waitForTimeout(250);
        await layout(page, `${label}, Month by month open`);
        const reg = month.locator("[role=region]");
        await reg.scrollIntoViewIfNeeded();
        if (i === 0) await shot(page, "stress_month_open");
        const m = await reg.evaluate((r) => {
          const card = r.closest("details").getBoundingClientRect();
          const rr = r.getBoundingClientRect();
          return { card: Math.round(card.width), cardRight: Math.round(card.right), client: r.clientWidth, scroll: r.scrollWidth, right: Math.round(rr.right), vw: document.documentElement.clientWidth };
        });
        check(`${label}: table region no wider than its card or the screen`, m.client <= m.card && m.right <= m.vw + 1 && m.cardRight <= m.vw + 1, JSON.stringify(m));
        check(`${label}: table region scrolls sideways`, m.scroll > m.client, JSON.stringify(m));
        // the region keeps its scroll position across tabs (same element), so start each tab from the left edge
        await reg.evaluate((r) => (r.scrollLeft = 0));
        const before = await lastHeader(page);
        check(`${label}: "Gap with loan" starts out of view inside the region`, before.header === "Gap with loan" && !before.inView, JSON.stringify(before));
        // keyboard: the region is focusable; arrow keys scroll it
        await reg.focus();
        for (let k = 0; k < 20; k++) await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(200);
        const kb = await lastHeader(page);
        check(`${label}: keyboard brings "Gap with loan" into view`, kb.inView && kb.scrollLeft > 0, JSON.stringify(kb));
        // touch: a horizontal swipe on the region (real touch events; centred so the docked bar is not under it)
        await reg.evaluate((r) => {
          r.scrollLeft = 0;
          r.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(250);
        const box = await reg.boundingBox();
        const x = Math.round(box.x + box.width / 2);
        const y = Math.round(box.y + Math.min(box.height / 2, 80));
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        for (let k = 1; k <= 12; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - k * 20, y }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(500);
        const touch = await lastHeader(page);
        check(`${label}: touch swipe brings "Gap with loan" into view`, touch.inView && touch.scrollLeft > 0, JSON.stringify(touch));
        await cdp.detach();
      }
      await page.context().close();
    }

    // ---- options ("Compare all options" is opened by the bounds check)
    {
      const page = await open(full, vp, "/alternatives");
      await page.getByRole("heading", { level: 1, name: "What could you change?" }).waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      await shot(page, "options");
      await layout(page, `${w} options`);
      await page.context().close();
    }

    // ---- report, then with the appendix open
    {
      const page = await open(full, vp, "/report");
      await page.locator("h1#report-title").waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      await layout(page, `${w} report`);
      await page.getByRole("button", { name: "Show appendix" }).click();
      await page.locator("#appendix-body").waitFor();
      const clipped = await clippedElements(page);
      check(`${w} report, appendix open: nothing cut off`, clipped.length === 0, clipped.slice(0, 5).join(" | "));
      await page.context().close();
    }
  }
} catch (e) {
  check("walkthrough completed without exception", false, String(e?.stack ?? e).slice(0, 600));
} finally {
  await browser.close();
}
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
