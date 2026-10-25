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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });  // AGENT 5 VARIANT B: normal motion, no extra wait
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
  await page.getByRole("button", { name: /^Continue$/ }).waitFor({ timeout: 10000 });
  total += await axe("/intake");
  const asked = [];
  for (let i = 0; i < 6; i++) {
    const cont = page.getByRole("button", { name: /^Continue$/ });
    try { await cont.waitFor({ timeout: 4000 }); } catch { break; }
    const q = (await page.locator("h2").first().textContent()).trim();
    asked.push(q);
    const val = /take-home/i.test(q) ? "4200" : /essential/i.test(q) ? "2900" : /debt/i.test(q) ? "0" : /savings/i.test(q) ? "6000" : null;
    if (val === null) break;
    const okField = await tabTo(/^INPUT\|/);
    if (!okField) { check(`kbd: field for "${q}" reachable`, false); break; }
    await page.keyboard.type(val);
    const okBtn = await tabTo(/^BUTTON\|.*Continue/);
    if (!okBtn) { check(`kbd: Continue for "${q}" reachable`, false); break; }
    await page.keyboard.press(i % 2 ? "Space" : "Enter");
    await page.waitForTimeout(700);
  }
  check("kbd: 4 household questions answered by keyboard", asked.length >= 4, JSON.stringify(asked));

  // 3. Offer — keyboard: tabs (arrow keys), Choose a file (Enter -> file chooser), Confirm all, Save
  await page.goto(WEB + "/offer", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Type the terms|Enter terms/ }).waitFor();
  total += await axe("/offer (manual tab)");
  check("kbd: offer tabs reachable", await tabTo(/tab\|.*(Type the terms|Enter terms)/));
  await page.keyboard.press("ArrowRight");
  const upTab = page.getByRole("tab", { name: /Upload a document|Upload contract/ });
  let sel = null;   // poll: the selection re-renders asynchronously after the key press
  for (let i = 0; i < 20 && sel !== "true"; i++) { sel = await upTab.getAttribute("aria-selected"); if (sel !== "true") await page.waitForTimeout(100); }
  check("kbd: ArrowRight selects the Upload tab", sel === "true");
  total += await axe("/offer (upload tab)");
  check("kbd: Choose a file reachable", await tabTo(/^BUTTON\|.*Choose a file/));
  check("kbd: focus indicator visible on Choose a file", await focusVisible());
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.keyboard.press("Enter")]);
  await chooser.setFiles(path.join(DOCS, "contract_standard.pdf"));
  await page.getByRole("heading", { name: /Check what we read/ }).waitFor({ timeout: 20000 });
  total += await axe("/offer (verification table)");
  check("kbd: Confirm all remaining reachable", await tabTo(/^BUTTON\|.*Confirm all remaining/, 200));
  await page.keyboard.press("Enter");
  check("kbd: Save checked offer reachable", await tabTo(/^BUTTON\|.*Save checked offer/));
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /See my results/ }).waitFor({ timeout: 15000 });

  // down-payment question (two-track intake)
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
  await page.getByText("What the loan costs").first().waitFor({ timeout: 15000 });
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
