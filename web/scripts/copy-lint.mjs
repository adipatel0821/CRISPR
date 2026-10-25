// Copy linter for user-facing strings (UX2 directive, section 10).
//
// Scans web/src/**/*.ts(x) (except *.test.ts, lib/contracts.ts, lib/api-types.ts and fixtures/) with the TypeScript
// parser and checks every string literal, template-literal part and JSX text for:
//   dash         an en dash (U+2013) or em dash (U+2014) typed into the string (escapes such as "—" are code,
//                not copy, and are allowed; the minus sign U+2212 and hyphen-minus are never flagged)
//   banned       a phrase from the banned list (same list as e2e/lib/density.mjs and src/lib/copy.ts)
//   exclamation  an exclamation mark ending a word ("Saved!"); "!important" style tokens are ignored
// Comments are never checked. Lines between "copy-lint-disable" and "copy-lint-enable" comments, and the line
// after a "copy-lint-ignore" comment, are skipped (for lists of banned phrases and similar code-only strings).
//
// Usage: node scripts/copy-lint.mjs [--json] [paths...]   (default path: src). Exit 1 when anything is found.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");

export const BANNED_PHRASES = [
  // copy-lint-disable
  "delve", "leverage", "unlock", "empower", "seamless", "robust", "cutting-edge", "cutting edge", "revolutionary",
  "transformative", "comprehensive insights", "navigate with confidence", "financial journey", "actionable insights",
  "tailored to your needs", "data-driven", "in today's world", "it's important to note", "it is important to note",
  "at the end of the day", "let's explore", "here's what you need to know", "whether you're", "not just",
  "game-changer", "game changer", "peace of mind", "rest assured", "elevate", "harness", "unleash", "supercharge",
  "intelligent", "ai-powered", "powered by ai", "effortless", "dive into", "deep dive",
  // copy-lint-enable
];

const EXCLUDE = [/\.test\.tsx?$/, /[\\/]lib[\\/]contracts\.ts$/, /[\\/]lib[\\/]api-types\.ts$/, /[\\/]fixtures[\\/]/];
const DASH_RE = /[–—]/;
const EXCLAIM_RE = /[A-Za-z0-9)\u2019][!](?=[\s"'`<)]|$)/;

function walkFiles(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const f of fs.readdirSync(p)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      walkFiles(path.join(p, f), out);
    }
  } else if (/\.(ts|tsx)$/.test(p) && !EXCLUDE.some((re) => re.test(p))) {
    out.push(p);
  }
  return out;
}

/** Line numbers (1-based) that the disable / enable / ignore comments switch off. */
function skippedLines(text) {
  const lines = text.split(/\r?\n/);
  const skip = new Set();
  let off = false;
  lines.forEach((line, i) => {
    if (/copy-lint-enable/.test(line)) off = false;
    if (off) skip.add(i + 1);
    if (/copy-lint-disable/.test(line)) off = true;
    if (/copy-lint-ignore/.test(line)) skip.add(i + 2);
  });
  return skip;
}

function snippet(s, i) {
  return s.slice(Math.max(0, i - 24), i + 25).replace(/\s+/g, " ").trim();
}

export function lintText(raw) {
  const issues = [];
  const dash = raw.search(DASH_RE);
  if (dash >= 0) issues.push({ rule: "dash", text: snippet(raw, dash) });
  const lower = raw.toLowerCase().replace(/’/g, "'");
  for (const p of BANNED_PHRASES) {
    const at = lower.indexOf(p);
    if (at >= 0) issues.push({ rule: `banned: ${p}`, text: snippet(raw, at) });
  }
  const ex = EXCLAIM_RE.exec(raw);
  if (ex) issues.push({ rule: "exclamation", text: snippet(raw, ex.index + 1) });
  return issues;
}

export function lintFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const skip = skippedLines(text);
  const found = [];
  const check = (node, raw) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    if (skip.has(line)) return;
    for (const issue of lintText(raw)) found.push({ file, line, ...issue });
  };
  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail: {
        // import / export paths are not copy
        const parent = node.parent;
        if (parent && (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent))) break;
        check(node, node.getText(sf)); // raw source: escapes such as — are not flagged
        break;
      }
      case ts.SyntaxKind.JsxText:
        if (node.getText(sf).trim()) check(node, node.getText(sf));
        break;
      default:
        break;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const targets = args.filter((a) => !a.startsWith("--"));
  const roots = (targets.length ? targets : ["src"]).map((t) => path.resolve(WEB, t));
  const files = roots.flatMap((r) => walkFiles(r));
  const findings = files.flatMap((f) => lintFile(f));
  if (json) {
    process.stdout.write(JSON.stringify(findings.map((x) => ({ ...x, file: path.relative(WEB, x.file).replace(/\\/g, "/") })), null, 2) + "\n");
  } else {
    for (const x of findings) {
      console.log(`${path.relative(WEB, x.file).replace(/\\/g, "/")}:${x.line}  ${x.rule}  "${x.text}"`);
    }
    const byFile = new Map();
    for (const x of findings) byFile.set(x.file, (byFile.get(x.file) ?? 0) + 1);
    console.log(`\ncopy-lint: ${findings.length} finding(s) in ${byFile.size} file(s) (${files.length} files scanned)`);
  }
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
