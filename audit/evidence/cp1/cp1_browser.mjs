// CP1 live browser walkthrough: Next.js (:3000) -> FastAPI (:8000) -> engine -> dashboard. System Chrome.
import { chromium } from "playwright-core";

const WEB = "http://localhost:3000";
const OUT = process.argv[2] || ".";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " — " + detail : ""}`); };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  check("welcome shows data-mode banner", /synthetic/i.test(await page.textContent("body")));
  await page.getByRole("checkbox").first().click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
  check("start -> /intake", true);

  const asked = [];
  for (let i = 0; i < 12; i++) {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    try { await cont.waitFor({ timeout: 6000 }); } catch { break; }
    const q = (await page.locator("h2").first().textContent()).trim();
    asked.push(q);
    if (/take-home/i.test(q)) await page.getByLabel(q).fill("4200");
    else if (/essential/i.test(q)) await page.getByLabel(q).fill("2900");
    else if (/debt/i.test(q)) await page.getByLabel(q).fill("0");
    else if (/savings/i.test(q) && !/down payment/i.test(q)) await page.getByLabel(q).fill("6000");
    else if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click();
    else { console.log("   unexpected question:", q); break; }
    await cont.click();
    await page.waitForTimeout(700);
  }
  console.log("   questions:", asked);
  check("adaptive intake asked the 4 household questions (offer not yet added)", asked.length >= 4, String(asked.length));
  await page.screenshot({ path: `${OUT}/cp1_intake.png`, fullPage: true });

  await page.getByRole("link", { name: /loan offer/i }).first().click();
  await page.waitForURL(/\/offer/, { timeout: 15000 });
  const fields = {
    "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
    "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
    "APR": "5.796", "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14",
  };
  for (const [label, v] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(v);
  const confirm = page.locator("#offer-confirm");
  if (await confirm.count()) { if (!(await confirm.isChecked().catch(() => false))) await confirm.click(); }
  await page.getByRole("button", { name: /Save offer/ }).click();
  await page.waitForTimeout(1500);
  const offerText = await page.textContent("body");
  check("offer saved without error", !/something went wrong|error/i.test(offerText.slice(0, 4000)) || /saved|ready/i.test(offerText));

  // the down-payment question may now be pending (two-track intake): answer it if the app asks
  const results_btn = page.getByRole("button", { name: /See my results/ });
  if (!(await results_btn.isEnabled().catch(() => false))) {
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    for (let i = 0; i < 4; i++) {
      const cont = page.getByRole("button", { name: /^Continue$/ });
      try { await cont.waitFor({ timeout: 4000 }); } catch { break; }
      const q = (await page.locator("h2").first().textContent()).trim();
      asked.push(q);
      if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click();
      else break;
      await cont.click(); await page.waitForTimeout(700);
    }
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  }
  check("down-payment source asked (5th blocking question)", asked.some((q) => /down payment/i.test(q)), JSON.stringify(asked));
  await page.getByRole("button", { name: /See my results/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const dash = await page.textContent("body");
  // Blocking questions only (no refinements): left before = 4200-2900 = 1,300.00; after = 1300-375.14 = 924.86 (F14 = 0, labelled)
  for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "1,300", "924.86", "2,000"]) check(`dashboard shows ${v}`, dash.includes(v));
  check("savings before shown as $6,000 (not \"Not known\")", dash.includes("6,000.00") && !/Not known/.test(dash));
  check("labels unknown flexible spending / running costs", /discretionary/i.test(dash) && /running costs/i.test(dash));
  check("dashboard is live data (no fixture banner)", !/fixture/i.test(dash));
  check("no 'verified' wording on dashboard", !/\bverified\b/i.test(dash));
  await page.screenshot({ path: `${OUT}/cp1_dashboard.png`, fullPage: true });

  for (const p of ["stress", "alternatives", "report"]) {
    await page.goto(`${WEB}/${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const t = await page.textContent("body");
    check(`/${p} renders results`, t.length > 500 && !/Start a session first|Something went wrong/i.test(t));
    if (p === "stress") check("stress labelled illustrative", /illustrative/i.test(t));
    if (p === "alternatives") check("alternatives show same-rate label", /same rate/i.test(t));
    await page.screenshot({ path: `${OUT}/cp1_${p}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("dashboard has no horizontal scroll at 360px", overflow <= 0, `overflow ${overflow}px`);
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 400));
  await page.screenshot({ path: `${OUT}/cp1_failure.png`, fullPage: true }).catch(() => {});
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
