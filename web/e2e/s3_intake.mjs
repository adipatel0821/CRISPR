// UX3 screen A: Welcome + Financial intake, live (Next.js -> FastAPI). Drives the real API through the UI.
//
// Checks: the default path asks exactly take-home, essentials, debts, savings, down payment (in that order);
// Enter continues; Skip defers (asked again later); "I'd rather not say" is never re-asked; an estimate is
// recorded; validation appears under the input for "-5" and "abc"; an earlier answer is edited from the rail;
// a deficit household is acknowledged once; one primary action per state; copy has no dashes / banned phrases;
// axe 0 serious/critical; no horizontal scroll at 390; reference figures on the results after the intake
// (375.14 / 22,508.29 / 3,008.29 / 26,508.29 / 1,300.00 -> 924.86 / 6,000 -> 2,000) and with refinements
// (900.00 -> 474.86); screenshots at 1440x900, 1920x1080, 768x1024 and 390x844.
//
// Usage (playwright-core + axe-core resolvable from this file's folder; system Chrome):
//   WEB=http://localhost:3301 API=http://localhost:8301 node s3_intake.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { axe, copyClean, copyIssues, noHorizontalScroll, primaryActions } from "./lib/check.mjs";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
const WEB = process.env.WEB || "http://localhost:3301";
const API = (process.env.API || "http://localhost:8301") + "/api/v1";
const OUT = path.resolve(process.argv[2] || "s3_intake_out");
fs.mkdirSync(OUT, { recursive: true });

const OFFER = {
  label: "Dealer offer A",
  confirmed: true,
  terms: {
    cash_price: "22000.00", taxes_title_fees: "1500.00", cash_down: "4000.00", principal: "20000.00",
    amount_financed: "19500.00", prepaid_finance_charges: "500.00", contract_rate: "0.0475", apr: "0.05796",
    term_months: 60, monthly_payment: "375.14",
  },
};
const DEFAULT_PATH = ["income.take_home_monthly", "expenses.essential.total", "debts.count", "savings.liquid", "loan.down_payment_source"];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " :: " + detail : ""}`);
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
const pageErrors = [];

async function newPage(w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  return page;
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
const settle = (page, ms = 700) => page.waitForTimeout(ms);

async function stateChecks(page, label, { a11y = true } = {}) {
  const pa = await primaryActions(page);
  check(`${label}: exactly one visible primary action`, pa.visible === 1, JSON.stringify(pa.labels));
  const ci = await copyIssues(page);
  check(`${label}: copy clean (no dashes, banned phrases, "!")`, copyClean(ci), JSON.stringify({ v: ci.visible, a: ci.all }).slice(0, 400));
  check(`${label}: no horizontal scroll`, await noHorizontalScroll(page));
  check(`${label}: one h1`, (await page.locator("h1").count()) === 1, String(await page.locator("h1").count()));
  if (a11y) {
    const r = await axe(page, AXE);
    for (const v of r.all) console.log(`     - axe ${label} [${v.impact}] ${v.id} x${v.nodes} :: ${v.targets.join(" | ")}`);
    check(`${label}: axe 0 serious/critical`, r.serious.length === 0, r.serious.map((v) => v.id).join(","));
  }
}

async function start(page) {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.getByRole("checkbox", { name: /calculation tool/ }).click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
  await page.locator("[data-fact-key], [data-intake-done]").first().waitFor({ timeout: 15000 });
}

/** What the workspace shows now: { kind: "question" | "ack" | "done", key }. */
async function current(page) {
  await page.locator("[data-fact-key], [data-intake-done]").first().waitFor({ timeout: 15000 });
  if (await page.locator("[data-intake-done]").count()) return { kind: "done", key: null };
  const el = page.locator("[data-fact-key]").first();
  const key = await el.getAttribute("data-fact-key");
  const ack = (await page.locator("[data-question-kind=acknowledge]").count()) > 0;
  return { kind: ack ? "ack" : "question", key };
}

const amount = (page) => page.locator("form[data-fact-key] [data-amount-input] input").first();
const cont = (page) => page.getByRole("button", { name: /^Continue$/ });
const tile = (page, text) => page.locator("[data-option-tile]", { hasText: text }).first();
const VALUES = { "income.take_home_monthly": "4200", "expenses.essential.total": "2900", "debts.count": "0", "savings.liquid": "6000" };

/** Answer the question on screen with the reference household. */
async function answerDefault(page, key, { enter = false, values = VALUES } = {}) {
  if (key === "loan.down_payment_source") await tile(page, "savings").click();
  else if (values[key] !== undefined) await amount(page).fill(values[key]);
  else throw new Error("unexpected question " + key);
  if (enter && key !== "loan.down_payment_source") await amount(page).press("Enter");
  else await cont(page).click();
  await settle(page);
}

async function session(page) {
  return page.evaluate(() => ({ sid: sessionStorage.getItem("dt.session_id"), token: sessionStorage.getItem("dt.token") }));
}
async function api(method, p, body, token) {
  const r = await fetch(API + p, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}

/** Text of <main> with every <details> opened (figures that moved into disclosures count). */
async function mainText(page) {
  return page.evaluate(() => {
    document.querySelectorAll("details").forEach((d) => (d.open = true));
    return document.querySelector("main")?.textContent ?? "";
  });
}

try {
  // ------------------------------------------------------------------ A: welcome + default path (1440)
  console.log("A: welcome, default path, validation, Enter, estimate, edit from the rail, results");
  {
    const page = await newPage();
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await stateChecks(page, "welcome");
    check("welcome: Start disabled until consent", await page.getByRole("button", { name: /^Start/ }).isDisabled());
    check("welcome: privacy and limits one click away", (await page.locator("[data-banner] summary").count()) === 1);
    await start(page);
    await stateChecks(page, "intake q1");
    await shot(page, "A_intake_q1_1440");

    const asked = [];
    // validation under the input
    let st = await current(page);
    asked.push(st.key);
    for (const bad of ["-5", "abc"]) {
      await amount(page).fill(bad);
      await amount(page).press("Enter");
      await settle(page, 300);
      const err = page.locator("form[data-fact-key] p[id$='-err']");
      const txt = (await err.count()) ? (await err.innerText()).trim() : "";
      const below = (await err.count())
        ? (await err.boundingBox()).y >= (await page.locator("form[data-fact-key] [data-amount-input]").boundingBox()).y + 40
        : false;
      const described = ((await amount(page).getAttribute("aria-describedby")) || "").includes((await err.getAttribute("id").catch(() => "")) || "@@");
      check(`validation "${bad}": message under the input`, /Enter an amount/.test(txt) && below && described, txt);
      check(`validation "${bad}": still on take-home`, (await current(page)).key === "income.take_home_monthly");
    }
    if (true) await shot(page, "A_intake_validation_1440");
    // Enter continues
    await amount(page).fill("4200");
    await amount(page).press("Enter");
    await settle(page);
    st = await current(page);
    check("Enter continues to the next question", st.key === "expenses.essential.total", st.key);
    // estimate on essentials
    asked.push(st.key);
    await amount(page).fill("2900");
    await page.getByRole("checkbox", { name: /estimate/ }).click();
    await cont(page).click();
    await settle(page);
    for (let i = 0; i < 6; i++) {
      st = await current(page);
      if (st.kind === "done") break;
      asked.push(st.key);
      if (i === 1) {
        await stateChecks(page, `intake ${st.key}`);
        await shot(page, "A_intake_choice_1440");
      }
      await answerDefault(page, st.key, { enter: i === 0 });
    }
    check("default path asks exactly take-home, essentials, debts, savings, down payment", JSON.stringify(asked) === JSON.stringify(DEFAULT_PATH), JSON.stringify(asked));
    await page.getByRole("heading", { level: 1, name: /That's everything we need/ }).waitFor({ timeout: 8000 });
    await stateChecks(page, "intake done");
    check("done: primary goes to the loan offer", (await primaryActions(page)).labels.some((l) => /Continue to the loan offer/.test(l)));
    const rail = page.locator("aside[data-stage-rail]");
    const railText = await rail.innerText();
    check("rail: answers listed with values", /Take-home pay[\s\S]*\$4,200\.00/.test(railText) && /Savings[\s\S]*\$6,000\.00/.test(railText), railText.slice(0, 300));
    check("rail: estimate recorded and shown", /Essentials[\s\S]*\$2,900\.00[\s\S]*Estimate/.test(railText));
    check("rail: progress counts answers", /5 answers given/.test(railText), railText.slice(0, 200));
    await shot(page, "A_intake_done_1440");

    // edit an earlier answer from the rail (POST /facts supersede), then put it back
    await rail.getByRole("button", { name: "Edit Savings" }).click();
    await page.locator("[data-edit-answer='savings.liquid']").waitFor();
    check("edit: prefilled with the current answer", (await page.locator("#edit-savings\\.liquid").inputValue()) === "6,000.00");
    await stateChecks(page, "edit answer", { a11y: true });
    await shot(page, "A_intake_edit_1440");
    await page.locator("#edit-savings\\.liquid").fill("6500");
    await page.getByRole("button", { name: "Save answer" }).click();
    await settle(page, 1000);
    check("edit: saved and announced", /Updated: Savings you could use/.test(await page.locator("main").textContent()));
    check("edit: rail shows the new value", /\$6,500\.00/.test(await rail.innerText()));
    await rail.getByRole("button", { name: "Edit Savings" }).click();
    await page.locator("#edit-savings\\.liquid").fill("6000");
    await page.locator("#edit-savings\\.liquid").press("Enter");
    await settle(page, 1000);
    check("edit: Enter saves too (back to $6,000.00)", /Savings[\s\S]*\$6,000\.00/.test(await rail.innerText()));

    // add the reference offer through the API; the done state now leads to results
    const s = await session(page);
    await api("POST", `/sessions/${s.sid}/offers`, OFFER, s.token);
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
    await settle(page);
    const pa = await primaryActions(page);
    check("done with offer: the one primary action is See my results", pa.visible === 1 && /See my results/.test(pa.labels[0] || ""), JSON.stringify(pa.labels));
    check(
      "done with offer: running costs not included (limitation visible)",
      /New-car running costs \(insurance, fuel, maintenance\) aren.t included/.test(await page.locator("main").innerText()),
    );
    await stateChecks(page, "intake done with offer");
    await shot(page, "A_intake_done_offer_1440");
    await page.getByRole("button", { name: /See my results/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes("924.86"), null, { timeout: 30000 });
    const dash = await mainText(page);
    for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "1,300.00", "924.86", "6,000", "2,000"])
      check(`results after intake show ${v}`, dash.includes(v));

    // refinements through the intake UI: flexible 400, replaces current car yes, current car 260, new-car 310
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
    const refine = async (fact, fill) => {
      await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
      if (fact === "vehicle.new_ownership_costs_monthly") {
        await page.getByRole("button", { name: "Add running costs" }).click();
      } else {
        const det = page.locator("details[data-refinements]");
        if (!(await det.evaluate((d) => d.open))) await det.locator("summary").click();
        await det.locator("li", { has: page.locator("button") }).filter({ hasText: fact }).getByRole("button").click();
      }
      await page.locator("form[data-fact-key]").waitFor();
      if (fill === "Yes") await tile(page, "Yes").click();
      else await amount(page).fill(fill);
      await cont(page).click();
      await settle(page, 900);
    };
    await refine("extras", "400");
    await shot(page, "A_intake_refined_1440");
    await refine("replace", "Yes");
    await refine("current car", "260");
    await refine("vehicle.new_ownership_costs_monthly", "310");
    await page.locator("[data-intake-done]").waitFor({ timeout: 15000 });
    const railNow = await page.locator("aside[data-stage-rail]").innerText();
    check("refinements recorded in the rail", /Flexible spending[\s\S]*\$400\.00/.test(railNow) && /New car running costs[\s\S]*\$310\.00/.test(railNow) && /Current car costs[\s\S]*\$260\.00/.test(railNow), railNow.slice(0, 500));
    check("running-costs note gone once they are given", !/running costs \(insurance, fuel, maintenance\) aren.t included/.test(await page.locator("main").innerText()));
    await page.getByRole("button", { name: /See my results/ }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes("474.86"), null, { timeout: 30000 });
    const dash2 = await mainText(page);
    for (const v of ["900.00", "474.86"]) check(`results with refinements show ${v}`, dash2.includes(v));
    await page.context().close();
  }

  // ------------------------------------------------------------------ B: skip defers, decline never re-asked
  console.log("B: skip defers, decline is never asked again");
  {
    const page = await newPage();
    await start(page);
    const seq = [];
    let st = await current(page);
    check("B: starts with take-home", st.key === "income.take_home_monthly", st.key);
    seq.push(st.key + ":skip");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await settle(page);
    st = await current(page);
    check("B: skip moves on (take-home deferred)", st.key !== "income.take_home_monthly", st.key);
    for (let i = 0; i < 10; i++) {
      st = await current(page);
      if (st.kind === "done") break;
      if (st.key === "savings.liquid") {
        seq.push(st.key + ":decline");
        await page.getByRole("button", { name: "I'd rather not say" }).click();
        await settle(page);
        continue;
      }
      seq.push(st.key);
      await answerDefault(page, st.key);
    }
    console.log("   sequence:", JSON.stringify(seq));
    check("B: skipped take-home is not asked again in this pass", !seq.slice(1).includes("income.take_home_monthly"), JSON.stringify(seq));
    check("B: declined savings is never asked again", seq.filter((k) => k.startsWith("savings.liquid")).length === 1, JSON.stringify(seq));
    check("B: reaches the done state", (await current(page)).kind === "done");
    check("B: rail shows Not shared for savings", /Savings[\s\S]*Not shared/.test(await page.locator("aside[data-stage-rail]").innerText()));
    // skip defers: the done state lists the skipped answer (rail too) and lets the person add it later
    check("B: done state says all for now", (await page.locator("h1").innerText()).includes("That's all for now"));
    check("B: skipped take-home listed with an Add action", /Take-home pay/.test(await page.locator("[data-skipped]").innerText()));
    check("B: rail marks take-home as skipped", /Take-home pay[\s\S]*Skipped/.test(await page.locator("aside[data-stage-rail]").innerText()));
    await stateChecks(page, "B done with a skipped answer");
    await shot(page, "B_done_skipped_1440");
    await page.getByRole("button", { name: "Add Take-home pay" }).click();
    await page.locator("[data-edit-answer='income.take_home_monthly']").waitFor();
    await page.locator("#edit-income\\.take_home_monthly").fill("4200");
    await page.getByRole("button", { name: "Save answer" }).click();
    await settle(page, 1000);
    await page.locator("[data-intake-done]").waitFor();
    check("B: added later, the rail shows $4,200.00", /Take-home pay[\s\S]*\$4,200\.00/.test(await page.locator("aside[data-stage-rail]").innerText()));
    check("B: no skipped list once added", (await page.locator("[data-skipped]").count()) === 0);
    await page.context().close();
  }

  // ------------------------------------------------------------------ C: deficit household acknowledged once
  console.log("C: deficit household (take-home 2000, essentials 2900)");
  {
    const page = await newPage();
    await start(page);
    const seq = [];
    let acks = 0;
    for (let i = 0; i < 12; i++) {
      const st = await current(page);
      if (st.kind === "done") break;
      if (st.kind === "ack") {
        acks++;
        seq.push("ack:" + st.key);
        if (acks === 1) {
          await stateChecks(page, "acknowledgement");
          await shot(page, "C_acknowledge_1440");
        }
        await page.getByRole("button", { name: "I understand, continue" }).click();
        await settle(page);
        continue;
      }
      seq.push(st.key);
      await answerDefault(page, st.key, { values: { ...VALUES, "income.take_home_monthly": "2000" } });
    }
    console.log("   sequence:", JSON.stringify(seq));
    check("C: deficit acknowledged exactly once", acks === 1, JSON.stringify(seq));
    check("C: reaches the done state", (await current(page)).kind === "done");
    await page.context().close();
  }

  // ------------------------------------------------------------------ D: 390 px mobile
  console.log("D: 390 x 844");
  {
    const page = await newPage(390, 844);
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await stateChecks(page, "390 welcome");
    await start(page);
    await stateChecks(page, "390 intake q1");
    const summary = page.locator("[data-stage-rail] details summary").first();
    await summary.click();
    check("390: answers disclosure opens", await page.locator("[data-stage-rail] details").first().evaluate((d) => d.open));
    await summary.click();
    for (let i = 0; i < 6; i++) {
      const st = await current(page);
      if (st.kind === "done") break;
      await answerDefault(page, st.key);
    }
    await page.locator("[data-intake-done]").waitFor();
    await stateChecks(page, "390 intake done");
    await page.context().close();
  }

  // ------------------------------------------------------------------ E: screenshots at the four viewports
  console.log("E: screenshots");
  for (const [w, h] of [[1440, 900], [1920, 1080], [768, 1024], [390, 844]]) {
    const page = await newPage(w, h);
    await page.goto(WEB + "/", { waitUntil: "networkidle" });
    await settle(page, 400);
    await shot(page, `E_welcome_${w}`);
    await start(page);
    await settle(page, 400);
    await shot(page, `E_intake_q1_${w}`);
    for (let i = 0; i < 4; i++) {
      const st = await current(page);
      await answerDefault(page, st.key);
    }
    await shot(page, `E_intake_choice_${w}`);
    await answerDefault(page, "loan.down_payment_source");
    await page.locator("[data-intake-done]").waitFor();
    await shot(page, `E_intake_done_${w}`);
    check(`${w}px: no horizontal scroll on done`, await noHorizontalScroll(page));
    await page.context().close();
  }
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 600));
}
check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
