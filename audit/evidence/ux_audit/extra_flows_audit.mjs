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

// ---- 1. deficit household: 3100 take-home, 2900 essentials, one debt 410 -> -210 before the loan
{
  const j = await journey("deficit", [[/take-home/i, "3100"], [/essential/i, "2900"], [/how many monthly debt/i, "1"],
    [/(payment|pay).*(debt|loan)|monthly payment/i, "410"], [/kind|type of debt|what kind/i, "RADIO:student|loan|other"],
    [/savings/i, "1000"], [/down payment/i, "RADIO:else|other|savings"], [/right|correct|confirm|leaves|less than/i, "RADIO:yes|right|correct"]]);
  await enterOffer(j.page);
  if (!(await j.page.getByRole("button", { name: /See my results/ }).isEnabled().catch(() => false))) {
    // answer anything still pending (e.g. the H01 acknowledgement or the down-payment source) on /intake
    await j.page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    for (let i = 0; i < 4; i++) {
      const cont = j.page.getByRole("button", { name: /^Continue$/ });
      try { await cont.waitFor({ timeout: 4000 }); } catch { break; }
      const q = (await j.page.locator("main h2").first().textContent()).trim(); console.log(`   [deficit] pending: ${q}`);
      const radio = j.page.getByRole("radio").first();
      if (await radio.count()) await radio.click();
      await cont.click(); await j.page.waitForTimeout(700);
    }
    await j.page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  }
  const dash = await results_(j.page);
  check("deficit: H01 deficit acknowledgement asked exactly once", j.acks.length === 1, JSON.stringify(j.acks));
  check("deficit: results reachable", !!dash);
  if (dash) {
    check("deficit: negative leftover before the loan shown (−$210 / -210)", /[−-]\s?\$?210(\.00)?/.test(dash), (dash.match(/.{40}210.{20}/) || [""])[0]);
    check("deficit: deficit is named, not hidden", /deficit|short|less than you spend|more than you take home|shortfall/i.test(dash));
    check("deficit: no 'afford'/'approved'/'safe'/'recommend' wording", !/\b(afford|approved|safe|recommend)/i.test(dash));
    await j.page.screenshot({ path: `${OUT}/extra_deficit_dashboard.png`, fullPage: true });
  }
  await j.ctx.close();
}

// ---- 2. declined savings answer, then 3. delete my data
{
  const j = await journey("declined", [[/take-home/i, "4200"], [/essential/i, "2900"], [/how many monthly debt/i, "0"],
    [/savings/i, "DECLINE"], [/down payment/i, "RADIO:savings"]]);
  check("declined: savings question was offered and declined without re-asking", j.asked.filter((q) => /savings/i.test(q) && !/down payment/i.test(q)).length === 1, JSON.stringify(j.asked));
  await enterOffer(j.page);
  const dash = await results_(j.page);
  check("declined: results still reachable (other analyses run)", !!dash);
  if (dash) {
    check("declined: loan cost still shown (375.14)", dash.includes("375.14"));
    check("declined: savings-dependent figures not invented as $0 (no '$0.00 in savings')", !/\$0\.00\s+in savings/i.test(dash));
    check("declined: the choice is acknowledged (chose not to share / not shared / unavailable)", /not to share|didn.t share|not shared|unavailable|without your savings|declined/i.test(dash),
          (dash.match(/.{60}(share|unavailable|declin).{40}/i) || [""])[0]);
    await j.page.screenshot({ path: `${OUT}/extra_declined_dashboard.png`, fullPage: true });
    for (const p of ["stress", "alternatives", "report"]) {
      await j.page.goto(`${WEB}/${p}`, { waitUntil: "networkidle" }); await j.page.waitForTimeout(1000);
      const t = await j.page.textContent("body");
      check(`declined: /${p} renders without error`, !/Something went wrong|Unhandled|TypeError/i.test(t) && t.length > 300);
    }
  }
  // delete my data
  const { auth, sid } = j.getAuth();
  await j.page.goto(WEB + "/dashboard", { waitUntil: "networkidle" });
  await j.page.getByRole("button", { name: /Delete my data/ }).first().click();
  await j.page.getByRole("alertdialog").getByRole("button", { name: /Delete my data/ }).click();
  await j.page.waitForURL((u) => new URL(u).pathname === "/", { timeout: 15000 }).catch(() => {});
  check("delete: returns to the welcome page", new URL(j.page.url()).pathname === "/", j.page.url());
  const r = await fetch(`${API}/api/v1/sessions/${sid}`, { headers: { Authorization: auth } });
  check("delete: server session is gone (token now rejected 401/404)", r.status === 401 || r.status === 404, `HTTP ${r.status} sid=${sid}`);
  await j.page.goto(WEB + "/dashboard", { waitUntil: "networkidle" }); await j.page.waitForTimeout(800);
  check("delete: dashboard no longer shows the old results", !(await j.page.textContent("body")).includes("375.14"));
  await j.ctx.close();
}
check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(`\nRESULT: ${results.every(Boolean) ? "PASS" : "FAIL"} (${results.filter(Boolean).length}/${results.length})`);
await browser.close();
