// Print-emulated crops of /report (and screen crops of the 1280 alt/report pages), fixture or live.
// Usage: node ux_c_print.mjs OUT [setup=live|fixture]
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const WEB = process.env.WEB || "http://localhost:3000";
const OUT = process.argv[2] || "./ux_c_out";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

if (process.env.FIXTURE !== "1") {
  // reuse the flow's setup by importing would re-run checks; replicate minimal setup via the flow script is heavy,
  // so this script is only used in fixture mode or after manual setup in the same tab.
}
await page.goto(WEB + "/", { waitUntil: "networkidle" });
const cb = page.getByRole("checkbox").first();
if (await cb.count()) await cb.click().catch(() => {});
const start = page.getByRole("button", { name: /^Start/ });
if (await start.count()) await start.click().catch(() => {});
await page.waitForTimeout(1500);

for (const p of ["/alternatives", "/report"]) {
  await page.goto(WEB + p, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/fx${p.replace("/", "_")}_1280.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: `${OUT}/fx${p.replace("/", "_")}_390.png`, fullPage: true });
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.setViewportSize({ width: 360, height: 900 });
  const ov360 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(p, "overflow390", ov, "overflow360", ov360);
  await page.setViewportSize({ width: 1280, height: 900 });
}
await page.setViewportSize({ width: 760, height: 1000 });
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(300);
const h = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, i = 0; y < Math.min(h, 1600 * 4); y += 1600, i++) {
  await page.screenshot({ path: `${OUT}/print_${i}.png`, clip: { x: 0, y, width: 760, height: Math.min(1600, h - y) }, fullPage: true });
}
await page.pdf({ path: `${OUT}/fx_report.pdf`, format: "Letter" });
const pdf = readFileSync(`${OUT}/fx_report.pdf`, "latin1");
console.log("print height", h, "pdf pages", (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, "errors", errs);
await browser.close();
