# UX3 design plan: Peddle-inspired visual storytelling (binding for UX3 agents)

Spec: `implementation/UX3_BRIEF.md` (the owner's brief, verbatim). Reference screenshots (Peddle, copyrighted, view only, never copy into the repo):
`C:/Users/ADITYA~1/AppData/Local/Temp/claude/p--programs-Machine-learning/60371d15-5b9a-462a-a446-ed01961c395c/images/1.png` (guided input) and `.../images/2.png` (final offer).

Peddle principles we adapt (from the screenshots and peddle.com, 2026-10-25): a confident blue frame; one warm yellow call to action; a large white application surface; a compact left rail with progress, context and "Start over"; a wide right workspace holding one question or one result; very large display type for the result; secondary explanations below the result in two short columns; bottom-right primary action. Peddle's own identity (logo, Aventa / Acumin fonts, "Ta da!" wording, blue #1872ED, yellow #FFD94F, their graphics) is NOT copied.

## Identity
- **Colours** (tokens in globals.css `@theme`): brand blue `#2A64E3` (header band, big figures, selected states; white text on it passes AA), strong blue `#1C4FC4` (links on white), blue tint `#EAF1FF`; CTA sun yellow `#FFCE4A` with ink text, hover `#F5BF2E`; canvas `#F4F6FA`; surface `#FFFFFF`; ink `#1B2433`, ink-2 `#4B5568`, ink-3 `#667085`; line `#E4E8EF`; savings green `#0E8A5F`; shortfall coral `#D9483B`; caution amber text `#9A5B00` on `#FFF4DC`. Charts: "without the loan" slate `#94A3B8`, "with the loan" brand blue. Colour never carries meaning alone (labels, icons, patterns).
- **Type**: one family, Plus Jakarta Sans via next/font/google (400 to 800), tabular lining numerals for figures (verify `tnum`; fall back to Inter only if figures misalign). Display clamp(40px, 4vw, 64px) at -0.02em; result figures clamp(56px, 7vw, 100px); section headings 24 to 32 px; body 17 px / 1.6; labels 14 px minimum.
- **Mark**: an original "twin" mark (two overlapping rounded shapes), white on the blue band.
- **Icons**: lucide-react (already installed): Wallet, PiggyBank, CalendarDays, Car, Receipt, ShieldCheck, TriangleAlert, SlidersHorizontal, FileUp, Keyboard, CreditCard, ShoppingCart, BriefcaseBusiness, TrendingDown. Icons carry meaning, never decoration only.
- **Illustrations**: original inline SVG only (welcome: "your money and your loan, side by side"; small spot illustrations where they explain something). No stock, no 3D, no robots, nothing from Peddle.

## Layout system (replaces the 704 / 960 px columns)
- Full-width blue header band (about 64 px): mark + wordmark left; quiet right actions ("How it works" opens About with privacy, data mode and the disclaimer; "Start over"; "Delete my data" in a menu).
- Below it, one large white application surface with 16 px radius, width `min(96vw, 1760px)`, centred, filling the viewport height.
- Inside: **two panels** at >= 1024 px. Left rail `clamp(280px, 24%, 400px)`: stage title, progress, relevant answers or loan context, navigation to completed steps, "Start over" at the bottom. Main workspace takes the rest with padding `clamp(32px, 4vw, 80px)`. Text blocks stay at 60 to 70 characters, while visuals use the remaining width (asymmetric splits, not centred columns).
- Bottom action row in the workspace: Back (quiet) left, primary yellow pill right (one per screen, keeps `data-primary-action`).
- Tablet and mobile (< 1024 px): rail collapses to a compact progress bar with an accessible "Your answers" sheet or disclosure; content stacks in reading order; the primary action docks at the bottom; no horizontal scroll; no hover-only behaviour.

## Journey and screens (each looks distinct, one language)
Understand the person → Understand the offer → Reveal the impact → Explore vulnerability → Compare choices → Review the decision.
- **Welcome**: editorial hero (big headline, one sentence, yellow "Start"), original twin illustration, privacy and limits one click away. No invented trust signals.
- **Your money (intake)**: Peddle screenshot 1 structure. Rail: "Your money" stage, progress, answered facts with edit. Workspace: one large question, a large currency input or option tiles / segmented control, one guidance line, "Why do we ask this?" disclosure, yellow Continue, quiet Skip / I'd rather not say / estimate. Adaptive logic unchanged.
- **Your loan (offer)**: choice tiles (FileUp "Upload the contract" / Keyboard "Enter the numbers"); manual entry grouped in short steps without hiding required fields; contract review with evidence on demand; confirmation with the key terms.
- **Summary**: Peddle screenshot 2 structure. Rail: loan context and journey (Summary, Stress test, Options, Report). Workspace: "Here's how this loan changes your month." + a huge figure (money left each month with the loan, backend value), before/after comparison bars on one honest zero-based scale, savings line ("$6,000 → $2,000 after the down payment"), the running-costs limitation when it applies, yellow primary action to the stress test, then two short secondary columns ("How we got this", "What to look at next") and the full breakdown in a disclosure.
- **Stress test**: most consequential scenario first (big finding "Savings run out in month 2", modelled shortfall, "Illustrative, not a prediction"), one trajectory chart (with vs without the loan, zero baseline), scenario tiles that switch the finding and chart, assumptions and monthly table collapsed, limitation instead of a result when an input is unknown.
- **Options**: up to three engine-computed alternatives, each with one big number, the trade-off in one sentence and a compact comparison bar against the current loan; full chart and table behind "Compare all options".
- **Report**: editorial summary (loan, what changes, main concern, options, what to confirm), bold numbers with small visuals, appendix with calculations, sources and assumptions; clean print.

## Untouched
backend/, contracts/, API calls and session behaviour (lib/api.ts, session-store.ts, app-context.tsx), engine results, question logic, insights.ts selector logic, provenance data, fixtures, the value assertions of the e2e scripts, rollback tags.
