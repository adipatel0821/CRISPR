// axe-core scan of all 7 pages of the live app (Next.js :3000 -> FastAPI :8000) + keyboard-only intake/offer pass.
// Usage (needs playwright-core and axe-core resolvable from the script's folder + system Chrome):
//   node a11y.mjs <path-to-axe.min.js> <path-to-backend/fixtures/documents>
// Reports serious/critical violations per page; exits 1 if any serious/critical violation or keyboard step fails.
import { chromium } from "playwright-core";
import path from "node:path";

const WEB = process.env.WEB || "http://localhost:3000";
const AXE = process.argv[2];
const DOCS = process.argv[3];
if (!AXE || !DOCS) {
  console.error("usage: node a11y.mjs <axe.min.js> <fixtures/documents dir>");
  process.exit(2);
}
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${!ok && detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
// reducedMotion: the app disables fade/slide transitions, so axe measures settled colours (mid-fade opacity gives false contrast hits)
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await ctx.newPage();

async function axe(label) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  });
  const serious = r.filter((v) => v.impact === "serious" || v.impact === "critical");
  console.log(`   ${label}: ${r.length} violation types, serious/critical: ${serious.length}`);
  for (const v of r) console.log(`     - [${v.impact}] ${v.id} x${v.n}: ${v.help} :: ${v.targets.join(" | ")}`);
  check(`axe ${label}: no serious/critical violations`, serious.length === 0, serious.map((v) => v.id).join(", "));
  return serious.length;
}

// --- keyboard helpers --------------------------------------------------------------------------
async function activeName() {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return "";
    const lab = (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) || el.closest("label");
    return [el.tagName, el.getAttribute("role") || el.getAttribute("type") || "", el.getAttribute("aria-label") || "", lab?.textContent || "", (el.textContent || "").slice(0, 80)].join("|");
  });
}
async function tabTo(re, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const n = await activeName();
    if (re.test(n)) return true;
  }
  return false;
}
async function focusVisible() {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
  });
}

let total = 0;
try {
  // 1. Welcome — keyboard only
  await page.goto(WEB + "/", { waitUntil: "networkidle" });
  total += await axe("/ (welcome)");
  check("kbd: consent checkbox reachable by Tab", await tabTo(/checkbox/i));
  check("kbd: focus indicator visible on checkbox", await focusVisible());
  await page.keyboard.press("Space");
  check("kbd: Start button reachable", await tabTo(/^BUTTON\|.*Start/));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/intake/, { timeout: 15000 });

  // 2. Intake — keyboard only (type into the focused field, Enter / Space on Continue)
  // UX3: the question is the h1 of form[data-fact-key]; the answer is chosen by fact key.
  await page.getByRole("button", { name: /^Continue$/ }).waitFor({ timeout: 10000 });
  total += await axe("/intake");
  const asked = [];
  const VALUES = { "income.take_home_monthly": "4200", "expenses.essential.total": "2900", "debts.count": "0", "savings.liquid": "6000" };
  for (let i = 0; i < 6; i++) {
    const form = page.locator("form[data-fact-key]").first();
    try { await form.waitFor({ timeout: 4000 }); } catch { break; }
    const key = await form.getAttribute("data-fact-key");
    const q = `${key}: ${(await form.locator("h1, h2").first().textContent()).trim()}`;
    const val = VALUES[key] ?? null;
    if (val === null) break;
    asked.push(q);
    const okField = await tabTo(/^INPUT\|(text|number|textbox)\|/);
    if (!okField) { check(`kbd: field for "${q}" reachable`, false); break; }
    await page.keyboard.type(val);
    const okBtn = await tabTo(/^BUTTON\|.*Continue/);
    if (!okBtn) { check(`kbd: Continue for "${q}" reachable`, false); break; }
    await page.keyboard.press(i % 2 ? "Space" : "Enter");
    await page.waitForTimeout(700);
  }
  check("kbd: 4 household questions answered by keyboard", asked.length >= 4, JSON.stringify(asked));

  // 3. Offer — keyboard: method tiles (native radios, arrow keys), Choose a file (Enter -> file chooser), Confirm all, Save
  // UX3: the method tabs became radio tiles "Upload the contract" / "Enter the numbers" (Enter the numbers selected by default).
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: /Enter the numbers/ }).waitFor();
  total += await axe("/offer (enter the numbers)");
  check("kbd: offer method tiles reachable", await tabTo(/radio\|.*Enter the numbers/));
  const upRadio = page.getByRole("radio", { name: /Upload the contract/ });
  let sel = false;   // arrow keys move through the radio group; poll because the selection re-renders asynchronously
  for (let k = 0; k < 2 && !sel; k++) {
    await page.keyboard.press("ArrowRight");
    for (let i = 0; i < 20 && !sel; i++) { sel = await upRadio.isChecked(); if (!sel) await page.waitForTimeout(100); }
  }
  check("kbd: arrow key selects Upload the contract", sel);
  total += await axe("/offer (upload the contract)");
  check("kbd: Choose a file reachable", await tabTo(/^BUTTON\|.*Choose a file/));
  check("kbd: focus indicator visible on Choose a file", await focusVisible());
  // register the file-chooser interception before the key press (Promise.all raced it and could miss the event)
  const chooserP = page.waitForEvent("filechooser", { timeout: 8000 });
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  const chooser = await chooserP;
  await chooser.setFiles(path.join(DOCS, "contract_standard.pdf"));
  await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
  total += await axe("/offer (verification table)");
  check("kbd: Confirm all remaining reachable", await tabTo(/^BUTTON\|.*Confirm all remaining/, 200));
  await page.keyboard.press("Enter");
  check("kbd: Save checked offer reachable", await tabTo(/^BUTTON\|.*Save checked offer/));
  await page.keyboard.press("Space");
  // UX3: with the down-payment question still open, the saved offer asks it inline ("Before your results") instead of See my results
  await page.locator("[data-saved-offer], section[aria-label='Before your results']").first().waitFor({ timeout: 15000 });

  // down-payment question (two-track intake), answered by keyboard on the intake stage
  await page.goto(WEB + "/intake", { waitUntil: "networkidle" });
  const cont = page.getByRole("button", { name: /^Continue$/ });
  if (await cont.isVisible().catch(() => false)) {
    check("kbd: down-payment radio reachable", await tabTo(/radio/i));
    // choose "savings" with arrow keys
    for (let i = 0; i < 4 && !/savings/i.test(await activeName()); i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    check("kbd: savings radio selected", /savings/i.test(await activeName()));
    check("kbd: Continue reachable", await tabTo(/^BUTTON\|.*Continue/));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
  }
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  check("kbd: See my results reachable", await tabTo(/^BUTTON\|.*See my results/));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.locator("[data-summary-hero]").waitFor({ timeout: 20000 });
  const dash = await page.textContent("body");
  check("kbd: keyboard-only journey reaches the dashboard with 375.14 and savings after 2,000.00",
    dash.includes("375.14") && dash.includes("2,000.00"));

  // 4. Results pages
  total += await axe("/dashboard");
  check("kbd: a source chip opens with Enter", await tabTo(/Source for Monthly payment/));
  await page.keyboard.press("Enter");
  check("kbd: popover visible", await page.locator("[data-radix-popper-content-wrapper]").first().isVisible());
  await page.keyboard.press("Escape");
  for (const p of ["stress", "alternatives", "report"]) {
    await page.goto(`${WEB}/${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    total += await axe(`/${p}`);
  }
} catch (e) {
  check("a11y run completed without exception", false, String(e).slice(0, 500));
}
await browser.close();
console.log(`\nTOTAL serious/critical violation types across pages: ${total}`);
const failed = results.filter((r) => !r.ok);
console.log(`RESULT: ${failed.length ? "FAIL" : "PASS"} (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
