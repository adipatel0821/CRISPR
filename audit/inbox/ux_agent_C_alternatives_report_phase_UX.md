=== STATUS PACKET ===
From: Screen agent C (Alternatives + Decision Report), worktree wf_15f01aa1-9d5-4
Phase: UX redesign. Screens /alternatives and /report are done and verified live.
Time: 2026-10-24 23:32 ET
Status: GREEN
Done:
- Branch feature/ux-alternatives-report was created from feature/ux-foundation (0c9f4b0). It has two commits: c5cb7f1 (pure view helpers and tests) and 9973433 (the two screens).
- /alternatives:
  - Title "What could you change?" with the framing lede.
  - Up to 3 comparison cards from highlightAlternatives. Each card has the slot label (Keep more savings / Lower monthly payment / Lower total borrowing cost), the change in plain words taken from lever_values, three signed deltas from deltas_vs_base ("Would be" shows the alternative's own metric), a one-sentence trade-off, assumption badges, and a "How this was calculated" disclosure with ProvenanceChips.
  - Slots the data doesn't support get a quiet one-line note.
  - One rate-sensitivity line, taken from the cl_rate_1pt claim.
  - "Compare all N options" disclosure containing the scatter (imported from charts.tsx), a sortable table that lists infeasible reasons, the "In words" comparison claims, and the notes.
  - One primary action: "Next: your decision report" → /report.
- /report (print-first, 48rem reading width):
  - Toolbar: Print / Save as PDF (the primary action) and Delete my data (with confirmation).
  - Main sections:
    - Executive summary (What changes / Main concern / Worth exploring)
    - Financial impact (the commitment figures, plus left each month and savings before→after, each with source and assumption chips; a running-costs disclosure with a link to /intake)
    - Principal concerns
    - Relevant alternatives (plus rate sensitivity)
    - Next actions (ask the lender, then gaps you can fill, then unknowns)
    - About this report (disclaimers, data mode, label legend, Assumptions disclosure with id=assumptions that opens on #assumptions)
  - Appendix: collapsed on screen behind a button with aria-expanded; always shown in print through `hidden print:block`. Sections A–H:
    - A. Calculation details with sources
    - B. Loan terms with where each came from
    - C. Payment schedule summary
    - D. Stress scenarios: claims for both runs plus the monthly table
    - E. All alternatives
    - F. Assumptions, unknowns and flags
    - G. Every statement with its sources
    - H. Technical identifiers
- New pure helpers (no arithmetic, tested, added to the npm test script):
  - components/alternatives/alt-view.ts: slotPlan, changeInWords, deltaItems, deltaSummaryLine, tradeOffSentence, assumptionBadges.
  - components/report/report-view.ts: scenarioClaimFor, reportSummary, principalConcerns, nextActions.
In progress: none
Blocked: none
Decisions made:
- lib/insights decisionSummary picks the first scenario_outcome claim for a scenario and ignores values.run. On live data that claim is the WITHOUT-loan one, so the "Main concern" read "without this loan your savings stay above zero…".
  - insights.ts is foundation-owned, so I did not edit it. The report uses reportSummary(), which swaps in the with_offer claim (or a template over backend strings).
- Running costs not included is always disclosed in Financial impact and Next actions. It is listed under Principal concerns only when nothing else is a concern, so it isn't repeated three times.
- Direction arrows on the deltas were removed for calm; the sign (+/−) carries the meaning, so colour is never the only signal.
- The alternatives table shows assumption notes as one muted line instead of badges.
- The print table drops the sort icons and the " vs offer" suffix, and the appendix note explains the smaller line instead.
- The session id is left out of the printed technical identifiers. Report, calc, offer and schema ids are included.
Assumptions:
- Badge texts for extra_down_from_savings and optional_add_ons_removed are mine: "Extra down payment comes from savings" and "Optional add-ons removed". When a lever implies one of these and the backend did not flag it, the badge is still shown.
- Adding my two test files to the "test" script in web/package.json is acceptable, even though package.json is a shared file.
Inputs used:
- Foundation primitives (@/components/system) and lib/insights.
- Fixture report.json.
- Live backend on 8103 with the manual reference household and offer (4200/2900/0/6000, down payment from savings; 22000/1500/4000/20000/19500/500/5.796/4.75/60/375.14).
Outputs given:
- Edited: web/src/app/alternatives/page.tsx, web/src/app/report/page.tsx, web/package.json (test script only).
- New: web/src/components/alternatives/{alt-view.ts, alt-view.test.ts, alt-card.tsx, alt-table.tsx} and web/src/components/report/{report-view.ts, report-view.test.ts, report-sections.tsx, report-appendix.tsx}.
- Not edited: report-parts.tsx, report-gate.tsx (both kept as they were; the dashboard still imports report-parts).
- Screenshots in scratchpad/e2e/ux_c_out (live and fixture, 1280/390, print crops, report.pdf).
Tests:
- npm test: 49/49 pass (11 tests are new).
- npx tsc --noEmit: clean.
- npx eslint .: clean.
- npx next build: passes, both live-API and NEXT_PUBLIC_USE_FIXTURES=1 builds.
- Live Playwright run (scratchpad/e2e/ux_c_flow.mjs, system Chrome): 38/38 PASS.
  - Figures shown: 375.14 / 22,508.29 / 3,008.29 / 26,508.29 / 6,000.00 → 2,000.00.
  - Layout and keyboard: no horizontal scroll at 360 px on either page; the disclosure and appendix open by keyboard.
  - Print emulation: appendix visible and site chrome hidden. The live PDF is 16 Letter pages, most of them appendix.
  - axe-core: 0 serious/critical on /alternatives (disclosure open) and on /report (collapsed and open).
  - No console errors.
- Fixture mode: both pages render, no overflow at 390 or 360 px; PDF is 11 pages.
- The infeasible-reason row was not seen live (live data had no infeasible alternative). It renders with the fixture alt_d3000.
- Servers on 3103/8103 are stopped and ux_3103.db is deleted.
Questions for auditor:
- Foundation lib/insights scenarioClaim (used by decisionSummary for concern and next) can return the without-offer scenario claim on live data. The dashboard and any other screen using decisionSummary probably show the wrong sentence for "Main concern". Fix it in insights.ts by preferring values.run === 'with_offer'; the pattern is in report-view.ts scenarioClaimFor.
- package.json "test" script: other screen agents may also append test files there, so expect a trivial merge conflict.
=== END PACKET ===
