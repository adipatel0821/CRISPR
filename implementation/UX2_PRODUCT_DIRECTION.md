# UX2 product direction (supervisor addendum, binding)

Owner feedback (2026-10-25 04:10 ET): "Make this look more like a product rather than an insurance page, because it feels like that."

## Why it reads like an insurance page (from the baseline screenshots)

- **The welcome is a quote landing page:** marketing headline, explanatory paragraph, a numbered 1 · 2 · 3 process, a legal consent box with a disabled grey Start, and a "not financial advice" footer.
- **Every screen is a document:** small grey eyebrow, formal title ("Financing a $22,000 car over 60 months"), explanatory lede, tinted callout boxes ("The most important concern" in red with a warning icon), footnote chips under every number ("Calculated · 2 sources"), timestamp / version / report-id lines, and the same legal footer on every page.
- **Nothing reacts:** you fill in forms, then read pages. A product lets you operate something and see it respond.
- **Colour code of insurance:** teal plus rose and amber alerts.
- **The journey starts with questions about you,** not with the thing you came with (the loan offer).

## What to do instead

All rules in UX2_DIRECTIVE.md still apply: web/ only, no backend change, no money arithmetic in TypeScript, evidence one click away, material limitations visible, accessibility, one primary action, copy rules.

1. **App frame, not a website.** Compact top bar: mark + name; once an offer exists, a small chip describing the loan from its terms (for example "$20,000 · 60 mo · 4.75%", formatting only); step or tab navigation; an overflow menu (icon button labelled "More") holding Start over, Delete my data and About this analysis (data mode, privacy, the disclaimer). No legal footer on every page: the disclaimer lives in About, in the report, and as one short line at the end of the results summary. On mobile the screen's primary action docks in a sticky bottom bar.
2. **Product navigation labels.** Setup: "Your loan" then "Your money". Results tabs: "Summary", "Stress test", "Options", "Report" (quiet tabs, aria-current). No methodology names (Understand, Vulnerabilities, Decide) in the UI.
3. **Start with the loan.** Start goes to the loan offer first (upload or enter), then the household questions, so the down-payment question can quote the offer. Keep a secondary "No offer yet? Start with your money" entry. Question logic and readiness do not change; only the order of screens does (two-track intake already supports it).
4. **One live element per results screen instead of document sections.**
   - Summary: one calm visual of the month, before and with the loan, built only from backend values (take-home, essentials and debt facts; payment, running-cost change and left-over metrics). Bar widths are presentation scaling, not money arithmetic. If the bar adds clutter, keep the before → after figure.
   - Options: an interactive explorer. Term chips (36, 48, 60, 72) and extra-down chips (+$0, +$500, +$1,000, +$2,000) select among the alternatives the engine already computed and update the payment, finance charge and savings-after figures instantly. Infeasible combinations are disabled with their reason, and "Same rate assumed" shows when the term differs.
   - Stress test: the selected scenario's chart with a with-loan / without-loan toggle.
5. **Identity.**
   - Replace insurance teal with one understated product accent, for example a muted indigo/iris around #5B5BD6, used only for focus, selection, links and progress.
   - Charcoal primary buttons.
   - Consider Geist via next/font/google for UI and tabular numerals.
   - Headings with slight negative tracking; large, confident numbers.
   - A simple distinctive mark (two overlapping rounded shapes, a "twin").
   - No shields, stock icons or illustrations.
6. **Feel.**
   - Instant feedback: format currency as you type, Enter to continue, a small "Saved" toast instead of a status line.
   - Skeletons instead of spinners.
   - Short motion when values change, reduced-motion aware.
   - Remove document artifacts from default views: version, timestamp and report-id lines; "Sources (44)" counters; a chip beside every figure. One quiet "How we got this" per section is enough, and the evidence stays one click away.
7. **Voice.** Product verbs on buttons ("Add your loan", "Upload the contract", "Continue", "See results", "Try other terms", "Print summary"). No policy-document headings.
