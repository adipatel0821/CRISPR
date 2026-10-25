// Screen agent C live check: manual reference path -> /alternatives + /report (1280/390/360, print, axe).
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const WEB = process.env.WEB || "http://localhost:3000";
const OUT = process.argv[2] || "./ux_c_out";
const ONLY_PAGES = process.env.ONLY_PAGES === "1";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? " — " + detail : ""}`); };
const axeSrc = readFileSync(new URL("./node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

async function axe(label) {
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const res = await axe.run(document, { resultTypes: ["violations"] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.target.join(" ")) }));
  });
  const bad = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe ${label}: 0 serious/critical`, bad.length === 0, JSON.stringify(r));
}

async function setup() {
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  const cb = page.getByRole("checkbox").first();
  if (await cb.count()) await cb.click();
  await page.getByRole("button", { name: /^Start/ }).click();
  await page.waitForURL(/\/intake/, { timeout: 15000 });
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
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  const fields = {
    "Cash price of the car": "22000", "Taxes, title and fees": "1500", "Cash down payment": "4000",
    "Principal (amount of the note)": "20000", "Amount financed": "19500", "Prepaid finance charges": "500",
    "APR": "5.796", "Contract (interest) rate": "4.75", "Term (months)": "60", "Monthly payment on the contract": "375.14",
  };
  await page.getByLabel("Cash price of the car", { exact: true }).waitFor({ timeout: 15000 });
  { const more = page.locator("summary", { hasText: "More details" });   // UX redesign: advanced terms are disclosed
    if (await more.count() && !(await more.first().evaluate((el) => el.parentElement?.open))) await more.first().click(); }
  for (const [label, v] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(v);
  const confirm = page.locator("#offer-confirm");
  if (await confirm.count()) { if (!(await confirm.isChecked().catch(() => false))) await confirm.click(); }
  await page.getByRole("button", { name: /Save offer/ }).click();
  await page.waitForTimeout(1500);
  const btn = page.getByRole("button", { name: /See my results/ });
  if (!(await btn.isEnabled().catch(() => false))) {
    await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
    for (let i = 0; i < 4; i++) {
      const cont = page.getByRole("button", { name: /^Continue$/ });
      try { await cont.waitFor({ timeout: 4000 }); } catch { break; }
      const q = (await page.locator("h2").first().textContent()).trim();
      if (/down payment/i.test(q)) await page.getByRole("radio", { name: /savings/i }).first().click(); else break;
      await cont.click(); await page.waitForTimeout(700);
    }
    await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  }
  await page.getByRole("button", { name: /See my results/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

async function shoot(path, name) {
  for (const w of [1280, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(WEB + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${name}_${w}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${path} no horizontal scroll at 360px`, overflow <= 0, `overflow ${overflow}px`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(WEB + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
}

try {
  await setup();
  check("setup reached dashboard", true);

  // ---------------- /alternatives ----------------
  await shoot("/alternatives", "alt");
  const at = await page.textContent("main");
  check("alt framing line", at.includes("What-if calculations under stated assumptions — not offers or recommendations"));
  check("alt h1", (await page.getByRole("heading", { level: 1, name: "What could you change?" }).count()) === 1);
  const cards = await page.locator("article[data-alt-id]").evaluateAll((els) => els.map((e) => e.getAttribute("data-alt-id")));
  console.log("   highlighted:", cards);
  check("1-3 highlighted cards", cards.length >= 1 && cards.length <= 3, String(cards.length));
  check("same rate assumed badge", at.includes("Same rate assumed — ask the lender"));
  check("rate sensitivity line", (await page.locator("[data-rate-sensitivity]").count()) === 1);
  check("no banned words on /alternatives", !/\b(verified|you can afford|recommended|best option|safe)\b/i.test(at));
  const sum = page.locator("summary", { hasText: /^Compare all \d+ options/ });
  check("Compare all N options disclosure", (await sum.count()) === 1);
  await sum.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  check("disclosure opens via keyboard", await page.locator("details:has(summary:has-text('Compare all'))").evaluate((d) => d.open));
  console.log("   info: infeasible reason shown =", /Needs \$|savings after the current down payment/i.test(await page.textContent("main")));
  await page.screenshot({ path: `${OUT}/alt_open_1280.png`, fullPage: true });
  await axe("/alternatives (open)");
  const next = page.getByRole("link", { name: /Next: your decision report/ });
  check("primary action -> /report", (await next.getAttribute("href")) === "/report");

  // ---------------- /report ----------------
  await shoot("/report", "report");
  const rt = await page.textContent("main");
  for (const v of ["375.14", "22,508.29", "3,008.29", "26,508.29", "6,000.00", "2,000.00"]) check(`report shows ${v}`, rt.includes(v));
  check("report: running costs disclosed", (await page.locator("[data-running-costs-missing]").count()) === 1 || /running costs/i.test(rt));
  check("report: no banned words", !/\b(verified|you can afford|recommended|best option|safe)\b/i.test(rt));
  for (const h of ["Executive summary", "Financial impact", "Principal concerns", "Relevant alternatives", "Next actions", "About this report", "Appendix"]) {
    check(`report section "${h}"`, (await page.getByRole("heading", { level: 2, name: h }).count()) === 1);
  }
  const appBtn = page.getByRole("button", { name: "Show appendix" });
  check("appendix collapsed on screen", (await appBtn.getAttribute("aria-expanded")) === "false" && !(await page.locator("#appendix-body").isVisible()));
  await axe("/report (collapsed)");
  // print emulation: appendix visible, chrome hidden
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  check("print: appendix body visible", await page.locator("#appendix-body").isVisible());
  check("print: toolbar hidden", !(await page.getByRole("button", { name: /Print \/ Save as PDF/ }).isVisible()));
  check("print: site header hidden", !(await page.locator("header[data-site-header]").isVisible()));
  await page.screenshot({ path: `${OUT}/report_print.png`, fullPage: true });
  await page.pdf({ path: `${OUT}/report.pdf`, format: "Letter", printBackground: false });
  {
    const pdf = readFileSync(`${OUT}/report.pdf`, "latin1");
    console.log("   pdf pages:", (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length);
    await page.setViewportSize({ width: 760, height: 1000 });
    await page.waitForTimeout(300);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0, i = 0; y < Math.min(h, 1500 * 5); y += 1500, i++) {
      await page.screenshot({ path: `${OUT}/print_${i}.png`, clip: { x: 0, y, width: 760, height: Math.min(1500, h - y) }, fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.emulateMedia({ media: "screen" });
  await appBtn.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  check("appendix opens via keyboard (aria-expanded=true)", (await page.getByRole("button", { name: "Hide appendix" }).getAttribute("aria-expanded")) === "true");
  const apx = await page.textContent("#appendix-body");
  check("appendix has amortization + ids", /Payment schedule summary/.test(apx) && /Report id/.test(apx) && /Every statement/.test(apx));
  await page.screenshot({ path: `${OUT}/report_open_1280.png`, fullPage: true });
  await axe("/report (appendix open)");
  // delete confirmation present (do not confirm)
  await page.getByRole("button", { name: /Delete my data/ }).first().click();
  check("delete asks for confirmation", (await page.getByRole("alertdialog").count()) === 1);
  await page.getByRole("button", { name: "Cancel" }).click();
} catch (e) {
  check("walkthrough completed without exception", false, String(e).slice(0, 500));
  await page.screenshot({ path: `${OUT}/failure.png`, fullPage: true }).catch(() => {});
}
check("no browser console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\nRESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
