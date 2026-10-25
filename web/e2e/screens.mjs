// Screen capture + density metrics for every primary screen state, at desktop and mobile widths.
// Sessions are prepared through the real API (same synthetic household and offer every run) and injected into
// sessionStorage, so the same states are captured on any version of the UI. Used for the before/after record of
// the UX simplification pass.
//
// Usage (needs playwright-core; system Chrome):  node screens.mjs <outDir>
//   env WEB (default http://localhost:3000), API (default http://localhost:8000), DOCS (fixture PDFs folder)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { measure } from "./lib/density.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = process.env.WEB || "http://localhost:3000";
const API = (process.env.API || "http://localhost:8000") + "/api/v1";
const DOCS = process.env.DOCS || path.resolve(HERE, "../../backend/fixtures/documents");
const OUT = path.resolve(process.argv[2] || "screens_out");
fs.mkdirSync(OUT, { recursive: true });

// Synthetic household (blocking questions only: the default path a user takes) and the audited reference offer.
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
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function prepare([nFacts, withOffer, withReport]) {
  const s = await api("POST", "/sessions", {});
  const out = { sessionId: s.session_id, token: s.token, dataMode: s.data_mode };
  if (nFacts) await api("POST", `/sessions/${s.session_id}/facts`, { facts: HOUSEHOLD.slice(0, nFacts) }, s.token);
  if (withOffer) out.offerId = (await api("POST", `/sessions/${s.session_id}/offers`, OFFER, s.token)).offer_id;
  if (withReport) out.reportId = (await api("POST", `/sessions/${s.session_id}/analysis`, {}, s.token)).report_id;
  return out;
}

async function openManual(page) {
  const choice = page.getByRole("tab", { name: /Enter (terms|details)/i })
    .or(page.getByRole("button", { name: /Enter (the )?(terms|details)( manually)?/i }))
    .or(page.getByRole("radio", { name: /Enter (the )?(terms|details)( manually)?/i }));
  if (await choice.count()) await choice.first().click();
}
async function upload(page) {
  const choice = page.getByRole("tab", { name: /Upload/i })
    .or(page.getByRole("button", { name: /Upload (a |the )?(contract|document)/i }))
    .or(page.getByRole("radio", { name: /Upload (a |the )?(contract|document)/i }));
  if (await choice.count()) await choice.first().click();
  await page.locator("input[type=file]").first().setInputFiles(path.join(DOCS, "contract_standard.pdf"));
  await page.waitForTimeout(4000);
}

const STATES = [
  { name: "01_welcome", path: "/", sess: null },
  { name: "02_intake_first_question", path: "/intake", sess: [0, false, false] },
  { name: "03_intake_third_question", path: "/intake", sess: [2, false, false] },
  { name: "04_intake_done", path: "/intake", sess: [5, false, false] },
  { name: "05_offer_start", path: "/offer", sess: [5, false, false] },
  { name: "06_offer_manual_form", path: "/offer", sess: [5, false, false], act: openManual },
  { name: "07_offer_saved", path: "/offer", sess: [5, true, false] },
  { name: "08_offer_upload_review", path: "/offer", sess: [5, false, false], act: upload },
  { name: "09_decision_summary", path: "/dashboard", sess: [5, true, true] },
  { name: "10_stress_tests", path: "/stress", sess: [5, true, true] },
  { name: "11_alternatives", path: "/alternatives", sess: [5, true, true] },
  { name: "12_report", path: "/report", sess: [5, true, true] },
  { name: "13_report_print", path: "/report", sess: [5, true, true], print: true },
];
// env WIDTHS="1440x900,1920x1080,768x1024,390x844" (default: 1280x900 and 390x844)
const WIDTHS = (process.env.WIDTHS || "1280x900,390x844").split(",").map((v) => {
  const [w, h] = v.split("x").map(Number);
  return { w, h };
});

const browser = await chromium.launch({ channel: "chrome", headless: true });
const results = [];
for (const st of STATES) {
  const sess = st.sess ? await prepare(st.sess) : null;
  for (const { w, h } of WIDTHS) {
    if (st.print && w !== WIDTHS[0].w) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    if (sess) {
      await ctx.addInitScript((s) => {
        sessionStorage.setItem("dt.session_id", s.sessionId);
        sessionStorage.setItem("dt.token", s.token);
        sessionStorage.setItem("dt.data_mode", s.dataMode);
        sessionStorage.setItem("dt.consent", "1");
        if (s.offerId) sessionStorage.setItem("dt.offer_id", s.offerId);
        if (s.reportId) sessionStorage.setItem("dt.report_id", s.reportId);
      }, sess);
    }
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      await page.goto(WEB + st.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(900);
      if (st.act) await st.act(page);
      await page.waitForTimeout(600);
      if (st.print) await page.emulateMedia({ media: "print" });
      const base = path.join(OUT, `${st.name}_${w}`);
      await page.screenshot({ path: `${base}_first_screen.png` });
      await page.screenshot({ path: `${base}_full.png`, fullPage: true });
      if (st.print) await page.pdf({ path: `${base}.pdf`, format: "Letter", printBackground: true });
      const m = await measure(page);
      results.push({ state: st.name, width: w, errors, ...m });
      console.log(
        `${st.name.padEnd(26)} ${String(w).padStart(4)}px  fold: ${String(m.fold.words).padStart(4)} words ${String(m.fold.moneyFigures).padStart(2)} $  ` +
          `| page: ${String(m.visible.words).padStart(4)} words ${String(m.visible.moneyFigures).padStart(3)} $ ${String(m.visible.charts)} charts ` +
          `${String(m.visible.tableRows).padStart(3)} rows | dashes vis ${m.visible.dashes} all ${m.all.dashes} | phrases ${m.all.bannedPhrases.join(",") || "-"}`,
      );
    } catch (e) {
      results.push({ state: st.name, width: w, error: String(e).slice(0, 400) });
      console.log(`${st.name} ${w}px ERROR ${String(e).slice(0, 200)}`);
    }
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "metrics.json"), JSON.stringify(results, null, 2));
console.log(`\nwrote ${results.length} measurements to ${path.join(OUT, "metrics.json")}`);
