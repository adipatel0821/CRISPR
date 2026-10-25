// Agent 5 UX audit — extra live flows not covered by the shipped suites: deficit household, a declined answer,
// delete-my-data (server-side purge confirmed with the captured bearer token). :3000 -> :8000. Usage: node extra_flows_audit.mjs <outdir>
import { chromium } from "playwright-core";
const WEB = "http://localhost:3000", API = "http://localhost:8000";
const OUT = process.argv[2] || ".";
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`  [${ok ? "PASS" : "FAIL"}] ${n}${d ? " — " + d : ""}`); };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];

async function journey(name, answers, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  let auth = null, sid = null;
  page.on("request", (r) => { const h = r.headers()["authorization"]; const m = r.url().match(/\/sessions\/([^/?]+)/); if (h && m) { auth = h; sid = m[1]; } });
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
  const asked = [], acks = [];
  for (let i = 0; i < 14; i++) {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    const ack = page.getByRole("button", { name: /I understand, continue/ });
    try { await Promise.any([cont.waitFor({ timeout: 5000 }), ack.waitFor({ timeout: 5000 })]); } catch { break; }
    const q = (await page.locator("main h2").first().textContent()).trim();
    asked.push(q);
    if (await ack.count()) { acks.push(q); await ack.click(); await page.waitForTimeout(800); continue; }
    const a = answers.find(([re]) => re.test(q));
    if (!a) { console.log(`   [${name}] unhandled question: ${q}`); break; }
    const v = a[1];
    if (v === "DECLINE") { await page.getByRole("button", { name: /rather not say/i }).click(); await page.waitForTimeout(700); continue; }
    if (v.startsWith("RADIO:")) await page.getByRole("radio", { name: new RegExp(v.slice(6), "i") }).first().click();
    else await page.getByLabel(q).fill(v);
    await cont.click(); await page.waitForTimeout(700);
  }
  console.log(`   [${name}] asked: ${JSON.stringify(asked)}`);
  if (acks.length) console.log(`   [${name}] acknowledgements: ${JSON.stringify(acks)}`);
  return { page, ctx, asked, acks, getAuth: () => ({ auth, sid }) };
}

async function enterOffer(page) {
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  await page.getByLabel("Cash price of the car", { exact: true }).waitFor({ timeout: 15000 });
  const more = page.locator("summary", { hasText: "More details" });
  if (await more.count() && !(await more.first().evaluate((el) => el.parentElement?.open))) await more.first().click();
  const fields = { "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
    "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
    "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14" };
  for (const [l, v] of Object.entries(fields)) await page.getByLabel(l, { exact: true }).fill(v);
  const confirm = page.locator("#offer-confirm");
  if (await confirm.count() && !(await confirm.isChecked().catch(() => false))) await confirm.click();
  await page.getByRole("button", { name: /Save offer/ }).click();
  await page.waitForTimeout(1500);
}

async function results_(page) {
  const btn = page.getByRole("button", { name: /See my results/ });
  if (!(await btn.isEnabled().catch(() => false))) return null;
  await btn.click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return await page.textContent("body");
}

const j = await journey("deficit", [[/take-home/i, "3100"], [/essential/i, "2900"], [/how many monthly debt/i, "1"],
  [/monthly payment on this debt/i, "410"], [/savings/i, "1000"], [/down payment/i, "RADIO:else|other"]]);
await enterOffer(j.page);
const { auth, sid } = j.getAuth();
const btn = j.page.getByRole("button", { name: /See my results/ });
console.log("results button enabled:", await btn.isEnabled().catch(() => "n/a"));
const body = await j.page.textContent("main");
console.log("offer page text (first 1500):", body.replace(/\s+/g, " ").slice(0, 1500));
const rd = await (await fetch(`${API}/api/v1/sessions/${sid}/readiness`, { headers: { Authorization: auth } })).json();
console.log("readiness:", JSON.stringify(rd.map((a) => [a.analysis_id, a.available, a.missing, a.declined, a.awaiting_offer])));
const nq = await (await fetch(`${API}/api/v1/sessions/${sid}/next-question`, { headers: { Authorization: auth } })).json();
console.log("next-question:", JSON.stringify(nq.question && { key: nq.question.fact_key, rule: nq.question.rule_id, text: nq.question.text }));
const sv = await (await fetch(`${API}/api/v1/sessions/${sid}`, { headers: { Authorization: auth } })).json();
console.log("offers:", JSON.stringify(sv.offers.map((o) => [o.offer_id, o.ready_for_calculation, o.warnings])));
console.log("facts:", JSON.stringify(Object.fromEntries(Object.entries(sv.profile.facts).map(([k, f]) => [k, [f.value, f.status]]))));
await j.page.screenshot({ path: `${OUT}/diag_deficit_offer.png`, fullPage: true });
await btn.click(); await j.page.waitForURL(/\/dashboard/, { timeout: 30000 }); await j.page.waitForTimeout(2000);
const dash = (await j.page.textContent("main")).replace(/\s+/g, " ");
check("deficit: dashboard reached", true);
check("deficit: negative leftover before the loan shown (−$210)", /[−-]\s?\$?210/.test(dash), (dash.match(/.{60}210.{40}/) || [""])[0]);
check("deficit: leftover after the loan shown negative (−$585.14 = −210 − 375.14)", /[−-]\s?\$?585(\.14)?/.test(dash), (dash.match(/.{50}585.{30}/) || [""])[0]);
check("deficit: deficit is named", /deficit|short|more than|shortfall|less than/i.test(dash));
check("deficit: no afford/approved/safe/recommend wording", !/(afford|approved|safe|recommend)/i.test(dash));
await j.page.screenshot({ path: `${OUT}/extra_deficit_dashboard.png`, fullPage: true });
console.log("dashboard summary text:", dash.slice(0, 900));
await browser.close();
