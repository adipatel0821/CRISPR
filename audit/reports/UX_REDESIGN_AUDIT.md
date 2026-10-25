# UX Redesign Regression Audit — web/ @ 7fd7233

**Auditor:** Agent 5 (Independent Implementation Auditor) · 2026-10-24 23:35 – 2026-10-25 00:15 EDT
**Scope:** `web/` only. Backend, contracts and engine are unchanged since 4409742 (`git diff --stat 4409742 HEAD -- backend contracts` is empty).
**Question:** did any critical functionality regress?

I reproduced everything myself on a fresh database with a fresh production build and live servers (stopped afterwards). On top of the shipped suites I ran independent checks: selector-vs-API comparison, a normal-motion accessibility run, and deficit, declined-answer and delete flows.

## Answer: no critical regression
| Area | Verdict | Evidence (`audit/evidence/ux_audit/…`) |
|---|---|---|
| 1. No loan math in TypeScript | **PASS** | Code review plus grep (below) |
| 2. Traceability and honesty | **PASS** | Grep, screenshots, suites |
| 3. Insight correctness | **PASS** (16/16) | `insights/check_selectors_output.txt` |
| 4. Functional regression (live, fresh DB) | **PASS**: 226/226 shipped checks plus my extra flows | `live/*.txt` |
| 5. Test-script changes | **Legitimate**; no assertion weakened | `live/a11y_normal_motion*.txt`, git diff |
| 6. Usability brief | **Met** (judgement in §6) | Screenshots in `live/` |

Static checks: `next build` OK (live API base), **fixture-mode build (`NEXT_PUBLIC_USE_FIXTURES=1`) OK**, `tsc --noEmit` exit 0, `eslint` exit 0, and web unit tests **76/76**. After the fixture check I rebuilt `web/.next` with the live API base, so the tree is left as it was.

## 1. No loan math in TypeScript: PASS
- I reviewed `lib/insights.ts` and grepped `components/{summary,stress,alternatives,report,intake,offer}`, `lib/format.ts` and `lib/report.ts` for `Number(`, `parseFloat`, `Math.*`, `toFixed`, `reduce(` and binary arithmetic on values.
- The only numeric parsing is `comparable()` (insights.ts:28) and `displayNumber()` (format.ts:20). They are used for **comparison only**: choosing the worst-gap scenario and the best alternative per slot, checking a sign or null, and sorting tables.
- The other matches are formatting: `Math.abs` and the sign of a backend delta, and `fraction × 100` to print a backend rate as a percent. None of these is loan arithmetic.
- Every displayed money value maps to a backend field. Examples checked on screen against the API JSON:
  - "Would be $287.81": alternative `metrics.monthly_payment`.
  - "−$87.33": `deltas_vs_base.monthly_payment`.
  - "$10,198.32 left at month 12": scenario `savings_end`.
  - "37%": `break_even_m3`.
  - "−$585.14 from −$210.00": F09/F08.
- I independently recomputed several of these (e.g. 2000 + 12×924.86 − 2900 = 10,198.32; 375.14 − 287.81 = 87.33; 3222.00 − 3008.29 = 213.71) to confirm the backend fields are the ones displayed.

## 2. Traceability and honesty: PASS
- **Sources:** every consequential figure on the summary carries a provenance chip ("Calculated · N sources", popover with evidence). Alternatives carry "How this was calculated" disclosures, and the report has an "All sources" appendix.
- **Forbidden wording:** `verified` appears only in provenance.ts/provenance-chip.tsx code comments and in a sanitiser that rewrites any upstream "verified" to "checked". `safe` appears only in a code comment ("hydration-safe"). There is no user-facing approval, safe, afford, recommend or "best" wording. The live checks "no approval / verified language (visible)" pass, and so do my deficit-page checks.
- **Scenarios:** "Illustrative — not a forecast." appears on /stress (header) and in the report appendix.
- **Term alternatives:** "Same rate assumed — ask the lender" appears on every highlighted term alternative (badge) and in the summary's next item.
- **Running costs (a_no_running_costs):** shown on the summary banner ("aren't included — add them for a fuller picture" + "Add running costs"), as "Includes an assumption" chips on F09/F14/F10, in the limitations list, in the report, and in the backend `derived_status: "assumed"`. It is never presented as a confirmed $0.

## 3. Insight correctness: PASS
Method: I generated DecisionReport JSON through the real API (TestClient, throwaway DB) for the **reference household** and the **EDGE household** from `backend/scripts/demo_cases.py`. I ran the *shipped* selectors (`web/src/lib/insights.ts` via Node 24 type-stripping) on that JSON, then compared their output with my own selection logic written in Python (`insights/check_selectors.py`).

| Check (both households) | Result |
|---|---|
| Change item figure = F08/F09 values; text = backend claim verbatim (ref 1300.00 → 924.86; edge 445.00 → 126.04) | PASS |
| Concern = WITH-loan scenario with the largest unfunded gap (ref sc_job_loss 3,625.42; edge sc_job_loss 5,421.88 over spike 1,697.92 and income cut 1,420.84) | PASS |
| Concern claim is the `_with_offer` claim, and its figure equals that run's `max_unfunded_gap` (the 8ab1ed0 fix holds) | PASS |
| highlightAlternatives = independent selection | PASS. **Ref:** lower payment = 72 months + $2,000 down; lower total cost = 36 months + $2,000 down; *keeps more savings* skipped honestly ("None of the options leaves more in savings than your offer as written"). **Edge:** only lower total cost (36 months); lower payment skipped because no feasible alternative improves it (72 months is already the longest term, and extra down exceeds $400 savings) |
| Same-rate disclosure on every highlighted term alternative | PASS |
| a_no_running_costs in limitations, and with_offer `derived_status` "assumed" | PASS |

## 4. Functional regression: PASS
Fresh DB (`backend/data/audit_ux.db`, synthetic_only, CORS localhost:3000), fresh `next build` with the API base, live servers on :8000/:3000, scripts run from the scratchpad copy:

| Suite | Result |
|---|---|
| ux_a_flow (welcome, intake, offer, documents, mobile) | **58/58** |
| ux_b_flow (summary, stress) | **47/47** |
| ux_c_flow (alternatives, report, print) | **38/38** |
| doc_flow (3 document journeys) | **32/32** |
| manual_flow (typed journey, dashboard figures, D1-001 chips) | **25/25** |
| a11y (axe on 9 page states + keyboard) | **26/26** |
| **Total** | **226/226**, matching the Supervisor's count |

Extra flows I wrote (`extra_flows_audit.mjs`, `deficit_diag.mjs`):
- **Deficit household** (take-home 3,100; essentials 2,900; one debt 410):
  - The H01 acknowledgement is asked **exactly once** ("This leaves about −$210 each month before this loan. Is that right?").
  - The dashboard shows "−$585.14 left each month, from −$210.00" and names the shortfall in plain words, with no afford/approve/safe/recommend wording.
  - My first scripted attempt failed only because my script checked the results button before the page re-hydrated; a rerun with a proper wait passed 5/5 (`live/deficit_dashboard.txt`). This is not an app defect.
- **Declined answer:** declining savings is offered once and never re-asked. Results stay reachable, the loan cost is shown, savings figures are not invented as $0, and /stress, /alternatives and /report render without errors.
- **Edit answer:** the shipped ux_a check "manual: edit saved (status updated)" passes.
- **Delete my data:** the dialog (alertdialog) confirms, the app returns to `/`, and **the server rejects the old bearer token with 401** (session purged). The dashboard no longer shows old results, and there are no uncaught page errors.
- **Responsive:** no horizontal scroll at 360/390 px on welcome, intake, offer, dashboard, stress, alternatives and report (shipped checks).

## 5. Test-script changes: legitimate
- **Diff of the pre-existing scripts** (`a11y.mjs`, `doc_flow.mjs`, `manual_flow.mjs`, 4409742..HEAD): tab-name regexes widened to accept the new labels (old ones still accepted), opening "More details" before filling the advanced fields, polling `aria-selected` after the arrow key, and `reducedMotion: "reduce"` for axe. **No assertion was removed or loosened**; every `check(...)` condition is unchanged.
- **reducedMotion:** I ran axe in **normal motion** two ways.
  - (B) Scanning immediately after navigation flags `color-contrast` on /intake, /offer upload and the verification table (23/26). These are elements caught mid-fade.
  - (C) The same normal-motion run with a settle wait before each scan gives **26/26 with 0 serious/critical**, including every state that failed in (B).
  - So the settled colours pass. reducedMotion only removed transition timing noise and does not hide a real contrast problem. Residual (LOW): text is briefly low-contrast during entrance fades, which is cosmetic.

## 6. Usability judgement (brief)
Screenshots reviewed: `live/dash_1280/390`, `alt_1280`, `stress_1280`, `report_*`, intake and offer at 1280/390.
- **Minimalist:** yes. White space, one card per idea, muted chrome, and numbers set as the visual anchor.
- **One primary action per screen:** yes. A single black primary button ("Next: see how it holds up", "Next: explore alternatives", "Next: your decision report", "See my results"), with secondary actions as quiet links.
- **Progressive disclosure:** yes. "See the full cost breakdown", "Show details" per scenario, "How this was calculated", "More detail" accordions (flags, assumptions, unknowns, all 44 sources), and "More details" on the offer form.
- **Coherent journey:** yes. Understand → Vulnerabilities → Alternatives → Decide tabs with progress state, and each page ends by pointing to the next.
- **Responsive at 390 px:** yes. The 390 px dashboard stacks cleanly with no overflow.
- **Minor (LOW):**
  1. The summary's "What to explore next" uses the backend key-point alternative (36 months, no extra down), while the Alternatives page highlights "36 months + $2,000 down" as the lower-total-cost option. Both are correct but could read as inconsistent; consider showing the same pick or labelling the difference.
  2. Brief contrast during entrance fades (see §5).

## Directives
None. No evidence-backed defect warrants a directive; the two LOW items above are polish.

## Cleanup
- Servers stopped (pids 13524, 21220, plus a sweep of next/uvicorn processes). Ports 3000/8000 are confirmed free and there are 0 leftover processes.
- `backend/data/audit_ux.db` deleted.
- `web/.next` rebuilt with the live API base after the fixture-mode build check.
- Nothing committed. Only `audit/evidence/ux_audit/` and this report were written.

GO — NO CRITICAL REGRESSION

---

## Addendum: re-verification at fa198d9 (constraint-aware alternative highlights), 2026-10-25 ~00:35 EDT
- **Diff (`git show fa198d9 -- web/src/lib`):** compare-only. `keepsSavings` reads the backend `deltas_vs_base.savings_after_purchase` through `comparable()` (≥ 0 or null counts as savings-neutral). `pickBest` is the previous loop, unchanged. Payment and cost slots try the savings-neutral pool first and fall back to all feasible candidates only when that pool has nothing that improves on the base. `preserveSavings` is unchanged. There is no money arithmetic and no new numeric parsing.
- **Changed test expectation: legitimate.** In the "dedupes…" test, alternative `b` improves payment and cost without drawing down savings, while `a` takes $1,000 from savings. Under the new policy `b` correctly wins all three slots. The test still asserts the deduplication: one entry carrying three slots and three labels, so the assertion is not weakened. Two new tests cover the preference (t72/t36 chosen over the −$2,000 variants; preserveSavings skipped) and the fallback (the only improving option draws down savings, so it is chosen).
- **Selector check under the new policy** (`insights/check_selectors_fa198d9.py`, shipped selectors re-run on the saved API JSON): **ALL PASS, 16/16.**
  - **Reference:** lower payment = alt_003 "72 months" (319.78; −$55.36; savings delta 0.00). Lower total cost = alt_001 "36 months" (FC 1998.32; −$1,009.97; savings delta 0.00). This now agrees with the summary's "explore next" (alt_001), which **resolves polish item 1**. Keeps-more-savings is skipped honestly.
  - **EDGE:** lower total cost = alt_001 "36 months" (−$2,705.74, savings delta 0.00). Lower payment is **skipped honestly**: the only options with a lower payment (+$500/+$1,000/+$2,000 down) are all *infeasible* ("extra down payment … is more than your savings after the purchase ($400.00)"), so neither the savings-neutral pool nor the fallback can pick them. Nothing is invented.
- **Web unit tests 78/78, `tsc --noEmit` exit 0** (`web_unit_tests_fa198d9.txt`, `tsc_fa198d9.txt`).
- **New LOW observation** (pre-existing, not introduced by fa198d9): when `savings_after_purchase` is unknown (savings declined), its delta is null. `tradeOffSentence` may then end with "with no change to the other figures shown", although the savings effect is unknown rather than unchanged. Wording only; no number is affected.

**Verdict at fa198d9: GO — NO CRITICAL REGRESSION (confirmed).**
