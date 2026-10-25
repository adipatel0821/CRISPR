=== STATUS PACKET ===
From: Screen agent B (Decision summary + Stress tests), worktree wf_15f01aa1-9d5-3
Phase: UX redesign: /dashboard and /stress
Time: 2026-10-24 23:37 ET
Status: YELLOW (my screens are green on every check I ran; the one open failure is on /offer, which I don't own, and it has not been checked whether it was already failing on the base branch)
Done:
- Branch feature/ux-summary-stress created from feature/ux-foundation (0c9f4b0). Commits: 538d550, 7dc13d1, 30346ad.
- /dashboard is now a "Decision summary":
  - intro from report data;
  - three insights from decisionSummary, each with a sentence, one figure, a source chip and a link;
  - "The commitment": 3 KeyFigures, with 22,508.29 in the monthly-payment caption;
  - "Your month and savings": two before → after panels;
  - everything else behind Disclosures: cost breakdown, flags, assumptions & limitations, what we don't know, all sources;
  - one primary action, "Next: see how it holds up".
  - The running-costs limitation is always visible (as the concern or as a quiet note), with an "Add running costs" link.
- /stress:
  - framing lede with "Illustrative — not a forecast";
  - break-even as one Insight;
  - one concise card per scenario, with outcomes with vs without the loan taken from ScenarioResult fields. Only consequential cards are tinted: gap is rose, savings run out without a gap is amber, the rest stay neutral;
  - chart, claims, assumptions and the month table behind "Show details";
  - one primary action, "Next: explore alternatives".
- charts.tsx: palette now matches the design tokens; all exports kept.
- New pure helpers with tests: summary/select.ts and stress/outcome.ts.
In progress: none
Blocked: none
Decisions made:
- Both pages use the reading width (44rem) for a calm, conversational column.
- Gap scenarios use rose rather than amber, to match the foundation's Insight gap tone and the dashboard concern for the same scenario.
- Live claims use their own key names (monthly_left_before/after), so the cash-flow figure falls back to the metrics when the claim's before/after keys are absent.
- Live backend emits one scenario_outcome claim per run (values.run). foundation's insights.scenarioClaim takes the first one, which can be the WITHOUT-loan sentence. resolvePiece in my code re-selects the with_offer claim.
- Removed the FadeIn entrance on the dashboard insights: a11y.mjs runs axe right after reaching /dashboard, and the mid-fade opacity produced false colour-contrast failures.
- The commitment description contains "What the loan costs", because doc_flow.mjs and a11y.mjs wait on that text.
- Leading "Illustrative:" is stripped from scenario names, since the page framing already says it.
Assumptions:
- Editing web/package.json (the test script only, to register 2 new test files) is acceptable. This may conflict with other agents' edits to the same line.
- figure.tsx is left unchanged; nothing imports it any more.
Inputs used:
- feature/ux-foundation system primitives and lib/insights.
- Synthetic reference household (4200 / 2900 / 0 / 6000, down payment from savings) with the manual offer, and contract_standard.pdf plus the dealer worksheet via doc_flow.
- Fixture report.json.
Outputs given:
- Screens /dashboard and /stress.
- Screenshots in scratchpad/e2e/out/ux_b/.
- Scripts in scratchpad/e2e/: ux_b_flow.mjs, ux_b_doc_flow.mjs, ux_b_a11y.mjs, ux_b_fixture.mjs.
- All servers on 3102 and 8102 stopped (0 listeners left); ux_3102.db deleted.
Tests:
- tsc clean; eslint clean; npm test 49/49; next build passed (live and fixture).
- Live manual flow plus extras 47/47; doc_flow 32/32; fixture check PASS.
- a11y.mjs 25/26: axe 0 serious or critical on all pages. The one failure is "kbd: ArrowRight selects the Upload tab" on /offer (not my screen; NOT RUN on the base branch for comparison).
Questions for auditor:
- (1) Please route a fix for foundation insights.ts scenarioClaim, which should filter by values.run === 'with_offer'. My resolvePiece works around it on the dashboard only.
- (2) The /offer ArrowRight tab failure needs an owner.
- (3) Is the package.json test-script edit acceptable at merge time?
=== END PACKET ===
