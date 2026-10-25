# UX3 before / after comparison (integration)

- **Before**: the audited release (branch decisiontwin-implementation), captured by the visual agent into
  `audit/evidence/ux3/before/` (13 states at 1440x900, 1920x1080, 768x1024 and 390x844).
- **After**: `feature/ux3-integration` (foundation + intake + summary/stress + offer/options + report, merged, with the
  integration fixes), captured with the same `web/e2e/screens.mjs` states and viewports into `audit/evidence/ux3/after/`
  against the live API (synthetic_only, fresh SQLite DB) on ports 3305 / 8305.
- **Reference**: the two Peddle screenshots (guided input, final offer) were viewed side by side with the captures. Nothing
  from them (logo, fonts, wording, graphics) is in the repository.
- Palette note: after the screen agents finished, the owner changed the palette to monochrome (black frame band, white
  surface, greys) with a few blue accents (primary pill, progress and current step, selected tiles, links, the hero
  figure, the "with the loan" series). The captures show that palette, so the primary action is a blue pill, not the
  yellow pill the brief first described.

## Numbers per screen and viewport

"First screen" is the 1440x900 / 1920x1080 / 768x1024 / 390x844 viewport before scrolling. Dollar figures count money
values in text. "Visible primary actions" counts `[data-primary-action]` elements that are visible; the release did
not mark its primary actions, so its count reads 0 and is not comparable. Dashes are U+2014 / U+2013 in rendered text.

| State | Width | First-screen words (before → after) | First-screen $ figures | Page words | Page $ figures | Visible primary actions | Dashes on screen (before → after) | Errors (after) |
|---|---|---|---|---|---|---|---|---|
| 01_welcome | 1440 | 145 → 117 | 0 → 0 | 216 → 179 | 0 → 0 | 0 → 1 | 1 → 0 | 0 |
| 01_welcome | 1920 | 145 → 117 | 0 → 0 | 216 → 179 | 0 → 0 | 0 → 1 | 1 → 0 | 0 |
| 01_welcome | 768 | 145 → 91 | 0 → 0 | 216 → 179 | 0 → 0 | 0 → 1 | 1 → 0 | 0 |
| 01_welcome | 390 | 110 → 91 | 0 → 0 | 216 → 179 | 0 → 0 | 0 → 1 | 1 → 0 | 0 |
| 02_intake_first_question | 1440 | 112 → 96 | 0 → 0 | 315 → 168 | 0 → 0 | 0 → 1 | 0 → 0 | 0 |
| 02_intake_first_question | 1920 | 112 → 96 | 0 → 0 | 315 → 168 | 0 → 0 | 0 → 1 | 0 → 0 | 0 |
| 02_intake_first_question | 768 | 112 → 72 | 0 → 0 | 315 → 168 | 0 → 0 | 0 → 1 | 0 → 0 | 0 |
| 02_intake_first_question | 390 | 75 → 72 | 0 → 0 | 315 → 168 | 0 → 0 | 0 → 1 | 0 → 0 | 0 |
| 03_intake_third_question | 1440 | 108 → 90 | 0 → 2 | 287 → 161 | 2 → 4 | 0 → 1 | 0 → 0 | 0 |
| 03_intake_third_question | 1920 | 108 → 90 | 0 → 2 | 287 → 161 | 2 → 4 | 0 → 1 | 0 → 0 | 0 |
| 03_intake_third_question | 768 | 108 → 69 | 0 → 0 | 287 → 161 | 2 → 4 | 0 → 1 | 0 → 0 | 0 |
| 03_intake_third_question | 390 | 71 → 69 | 0 → 0 | 287 → 161 | 2 → 4 | 0 → 1 | 0 → 0 | 0 |
| 04_intake_done | 1440 | 86 → 149 | 0 → 6 | 327 → 366 | 3 → 9 | 0 → 1 | 2 → 0 | 0 |
| 04_intake_done | 1920 | 121 → 149 | 0 → 6 | 327 → 366 | 3 → 9 | 0 → 1 | 2 → 0 | 0 |
| 04_intake_done | 768 | 121 → 87 | 0 → 0 | 327 → 366 | 3 → 9 | 0 → 1 | 2 → 0 | 0 |
| 04_intake_done | 390 | 84 → 85 | 0 → 0 | 327 → 366 | 3 → 9 | 0 → 1 | 2 → 0 | 0 |
| 05_offer_start | 1440 | 107 → 168 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 05_offer_start | 1920 | 142 → 200 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 05_offer_start | 768 | 139 → 142 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 05_offer_start | 390 | 79 → 84 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 06_offer_manual_form | 1440 | 107 → 168 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 06_offer_manual_form | 1920 | 142 → 200 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 06_offer_manual_form | 768 | 139 → 142 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 06_offer_manual_form | 390 | 79 → 84 | 0 → 0 | 323 → 438 | 0 → 0 | 0 → 1 | 2 → 0 | 0 |
| 07_offer_saved | 1440 | 101 → 123 | 2 → 4 | 228 → 309 | 9 → 13 | 0 → 1 | 1 → 0 | 0 |
| 07_offer_saved | 1920 | 146 → 140 | 2 → 4 | 228 → 309 | 9 → 13 | 0 → 1 | 1 → 0 | 0 |
| 07_offer_saved | 768 | 111 → 111 | 2 → 2 | 228 → 309 | 9 → 13 | 0 → 1 | 1 → 0 | 0 |
| 07_offer_saved | 390 | 81 → 76 | 2 → 1 | 228 → 309 | 9 → 13 | 0 → 1 | 1 → 0 | 0 |
| 08_offer_upload_review | 1440 | 138 → 180 | 3 → 1 | 1121 → 1188 | 24 → 24 | 0 → 1 | 14 → 0 | 0 |
| 08_offer_upload_review | 1920 | 165 → 199 | 4 → 2 | 1121 → 1188 | 24 → 24 | 0 → 1 | 14 → 0 | 0 |
| 08_offer_upload_review | 768 | 156 → 163 | 3 → 1 | 1121 → 1188 | 24 → 24 | 0 → 1 | 14 → 0 | 0 |
| 08_offer_upload_review | 390 | 111 → 84 | 1 → 0 | 1121 → 1188 | 24 → 24 | 0 → 1 | 14 → 0 | 0 |
| 09_decision_summary | 1440 | 175 → 134 | 11 → 10 | 991 → 905 | 30 → 36 | 0 → 1 | 7 → 0 | 0 |
| 09_decision_summary | 1920 | 192 → 192 | 11 → 15 | 991 → 905 | 30 → 36 | 0 → 1 | 7 → 0 | 0 |
| 09_decision_summary | 768 | 192 → 95 | 11 → 4 | 991 → 905 | 30 → 36 | 0 → 1 | 7 → 0 | 0 |
| 09_decision_summary | 390 | 112 → 78 | 7 → 3 | 991 → 905 | 30 → 36 | 0 → 1 | 7 → 0 | 0 |
| 10_stress_tests | 1440 | 172 → 144 | 3 → 11 | 1412 → 485 | 235 → 66 | 0 → 1 | 3 → 0 | 0 |
| 10_stress_tests | 1920 | 217 → 195 | 5 → 12 | 1412 → 490 | 235 → 66 | 0 → 1 | 3 → 0 | 0 |
| 10_stress_tests | 768 | 215 → 115 | 5 → 5 | 1412 → 491 | 235 → 66 | 0 → 1 | 3 → 0 | 0 |
| 10_stress_tests | 390 | 133 → 77 | 1 → 1 | 1388 → 485 | 235 → 66 | 0 → 1 | 3 → 0 | 0 |
| 11_alternatives | 1440 | 157 → 154 | 15 → 14 | 1235 → 1206 | 182 → 195 | 0 → 1 | 15 → 0 | 0 |
| 11_alternatives | 1920 | 181 → 194 | 15 → 16 | 1235 → 1206 | 182 → 195 | 0 → 1 | 15 → 0 | 0 |
| 11_alternatives | 768 | 168 → 113 | 15 → 5 | 1235 → 1206 | 182 → 195 | 0 → 1 | 15 → 0 | 0 |
| 11_alternatives | 390 | 108 → 76 | 8 → 1 | 1233 → 1205 | 180 → 194 | 0 → 1 | 15 → 0 | 0 |
| 12_report | 1440 | 145 → 159 | 7 → 10 | 3893 → 3537 | 443 → 393 | 0 → 1 | 30 → 0 | 0 |
| 12_report | 1920 | 172 → 173 | 9 → 12 | 3893 → 3537 | 443 → 393 | 0 → 1 | 30 → 0 | 0 |
| 12_report | 768 | 163 → 94 | 7 → 2 | 3893 → 3537 | 443 → 393 | 0 → 1 | 30 → 0 | 0 |
| 12_report | 390 | 109 → 83 | 4 → 1 | 3893 → 3537 | 443 → 393 | 0 → 1 | 30 → 0 | 0 |
| 13_report_print | 1440 | 153 → 262 | 11 → 17 | 3893 → 3537 | 443 → 393 | 0 → 0 | 30 → 0 | 0 |

Reading the table: on every redesigned screen the first screen carries fewer words at 768 and 390 px and the same or
more dollar figures at 1440 / 1920 (the figures moved up into big type instead of sentences). Page word counts fell
sharply on the stress test (1,412 to about 490) and modestly on the summary, options and report; the offer screens grew
because the rail, the method tiles and the grouped field help are new. Rendered dashes went from up to 30 per screen to
0 everywhere. Every after state has exactly one visible primary action except the print rendering, where the toolbar is
hidden on purpose.

## Screen by screen (critical)

**Welcome (01).** Before: a narrow centred column of small grey text with no visual anchor. After: black band, wide
white surface, a large editorial headline ("See what a car loan does to your month.") with the two key words in blue,
an original illustration filling the right half, consent and Start together, the data-mode line one click away, and a
three-step strip (Your money, Your loan, Your results). It uses the landscape and reads in the right order. Weak spots:
the disabled Start pill is a pale blue until the box is ticked and looks washed out; the illustration is large for the
amount it explains.

**Intake question (02, 03).** Follows the structure of the Peddle guided-input screen (rail with stage, progress,
answers with Edit and Start over; one large question in the workspace; the action at the bottom right) without its
look. The question is the single h1, the amount input is big and labelled, Skip and "I'd rather not say" are quiet,
"Why do we ask this?" is a disclosure. Weak spots: the question type is very heavy (800 weight) next to the light rail,
so it shouts a little; the spot illustration on the right is decorative and the panel around it is mostly empty.

**Intake done (04).** "That's everything we need" plus the month as told (the person's own amounts on one zero-based
scale, savings apart) and the running-costs limitation with "Add running costs". Weak spots: "What you can see so far
0 of 5 ready" is correct (no offer yet) but reads oddly right after "everything we need"; two stacked disclosures look
like form furniture.

**Loan offer (05 to 08).** Two large method tiles (Upload the contract / Enter the numbers), the manual form split into
"The car" and "The loan" cards with advanced terms under "More details from the contract", a clear confirmation with key
terms, and the document review as one card per term with Confirm / Correct / Reject and the source chip. Weak spots: the
review is long by nature (14 terms) and starts below the method tiles, so on 1440 x 900 only two terms are in view; the
rail counts "Step 2 of 3" while the results rail counts "Step n of 4" (two journeys, two counters).

**Decision summary (09).** The closest match to the Peddle final-offer screen: "Here's how this loan changes your
month." with $924.86 in very large blue type, the before/after bars ($1,300.00 → $924.86) on one zero-based scale with
the running-costs limitation inside the panel, the savings line ($6,000.00 → $2,000.00), the primary action at the right,
then "What the loan costs" and "What to look at next" in two columns, and everything else in "See the full breakdown".
The eye lands on the figure first. Weak spots: at 1920 the headline row leaves the right third empty; the grey
"Includes an assumption" chips are small.

**Stress test (10).** The most consequential what-if leads ("What if your income stopped for two months?"), with
"Savings run out in month 2" and the $3,625.42 modelled shortfall as big type, "Illustrative scenario, not a prediction"
at the top, and one savings chart (with and without the loan) where the shortfall is drawn below $0 with a hatch on the
same scale. Scenario tiles switch finding and chart. Before, this screen was a long stack of cards and tables (1,412
words, 235 dollar figures); now about 490 words with the table and assumptions collapsed. Weak spots: the chart sits in
a grey panel that is compact at 1440; "Without the loan" is a text block rather than a visual.

**Options (11).** A featured option with one big figure ($319.78 a month for 72 months), the benefit and the trade-off
in one sentence each ("You pay $516.25 more in finance charges"), the same-rate caveat and compact bars against your
offer; the full chart and table sit behind "Compare all N options". Weak spots: the other options start below the fold;
with bars from zero the finance-charge difference looks small, which is honest but undramatic.

**Report and print (12, 13).** An editorial report in the same frame: the loan, what changes, the main concern with its
own figures, the options, what to confirm before signing, with big numbers and small bars; the appendix prints only when
chosen. Weak spots: still the longest page (about 3,500 words with the appendix content in the DOM); the print view
fits more on the first page but is dense.

**Integration fix visible in the captures:** Summary, Stress test, Options and Report now share one rail (offer label,
"Step n of 4", the loan, the journey, Start over). Before the fix, Options and Report each had their own rail with
different titles and facts.

## Against the brief's acceptance criteria

| Criterion | Verdict |
|---|---|
| Uses landscape space; no narrow column; no huge unexplained margins | Met on every screen at 1440 and 1920 (two panels, asymmetric workspace). Remaining empty areas: right of the summary headline at 1920, the intake art panel. |
| Important figures stand out | Met: hero figures at 56 to 100 px on summary, stress and options; report figures large. |
| Text readable, contextual panels add value | Met: 17 px body, rail facts with Edit links, loan context on the results screens. |
| Visual variety across screens | Met: question + art, hero figure + bars, trajectory chart, featured option + bars, editorial report. |
| Primary action easy to find | Met: one pill per state (bottom right on desktop, docked at the bottom below 1024 px). |
| Looks art-directed, not an insurance portal | Mostly met. The monochrome palette the owner chose is calmer and less warm than Peddle's blue and yellow; the screens rely on type scale and the blue accent for energy. The offer review and the report are still the most form-like. |
| Mobile: reflow, hierarchy, comfortable inputs, no overflow, accessible navigation, no sideways scroll | Met in the captures and checks (390 and 360 px): rail collapses to a "Your loan and results" / "Your answers" disclosure, the primary docks at the bottom, figures fit. |
| Interaction: questions advance, progress persists, buttons and disclosures work, charts accurate, keyboard, reduced motion | Met in the e2e runs below (keyboard-only journey, disclosures by Enter, axe with reduced motion 0 serious/critical, chart from zero with the shortfall below it). |

## Emotional quality and text volume

Compared with the release, the first screens now show one idea each with a large figure or question, and the tone is
calm and specific. Compared with Peddle, the result screens match the hierarchy (huge figure, short explanation, one
action) but feel cooler because of the monochrome palette; the welcome illustration and the blue figure carry most of
the warmth. Text volume is lower on the summary and stress test, about the same on options, and still high in the
report and the document review, where the detail is the point.

## Checks behind this comparison

All on feature/ux3-integration, live API on :8305 (synthetic_only, fresh DB), web on :3305:
s3_foundation PASS (1440, 390); s3_intake 105/105; s3_summary_stress 94/94; s3_offer_options 227/227; s3_report 91/91;
manual_flow 25/25; doc_flow 32/32; a11y 26/26 with 0 serious/critical axe findings; screens.mjs 49 measurements, no
page errors. Backend: pytest 362 passed; demo_walkthrough PASS; demo_cases PASS; `git diff fe5e587 HEAD -- backend
contracts` empty.
