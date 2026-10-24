# Architecture Change Matrix (v1.0 → v1.1)

Priority: **P0** = financial correctness or safety, must ship in the MVP; **P1** = MVP-required for coherence; **P2** = documentation/labeling or deferral. Every change traces to issue IDs in the stage reviews and to an ADR in `supervisor/architecture_decisions.md`.

| Change ID | Stage | Original design | Problem (issues) | New design | Affected files | Priority |
|---|---|---|---|---|---|---|
| CH-01 | 3 | F01 payment on amount financed | Understates payment/cost when PFC > 0 (S3-ISSUE-001, RT-07) | F00 principal resolution; F01 on principal; payment-mismatch check ±$1 | stage_03 md/docx, contracts §3.6–3.7, simulation diagram, acceptance A-07r/A-24 | P0 |
| CH-02 | 3 | F05 APR from AF − PFC | Double subtraction (S3-ISSUE-002, RT-08) | F05 solves on AF; out-of-tolerance = `warn` | stage_03, stage_02, contracts §3.5 | P0 |
| CH-03 | 3 | F04 TOP + down + trade value | Gross trade value; rolled-in debt hidden (S3-ISSUE-003) | Total paid through deal with breakdown; positive equity only | stage_03, contracts §3.7, stage_06 | P0 |
| CH-04 | 3/4 | Reserve and stress from pre-purchase savings | Overstates reserve/runway (S3-ISSUE-004, S4-ISSUE-003, RT-11) | F13 savings after purchase; F10 after/before; S4 start balance = F13 | stage_03, stage_04, contracts §3.7–3.8, simulation diagram | P0 |
| CH-05 | 1/3 | Full new-car ownership costs; paid-off debts kept | Double count (S1-ISSUE-009, S3-ISSUE-005, RT-06) | Facts `vehicle.replaces_current`, `expenses.current_vehicle_costs_monthly`, `debts[i].paid_off_by_transaction`; F14 incremental; `debts_after` | stage_01, stage_03, contracts §3.1/§3.7, KG diagram | P0 |
| CH-06 | 2 | `LoanOffer` without principal/itemization | Wrong base; harm patterns invisible (S2-ISSUE-003, -009) | `principal`, `cash_down`, `itemization[]`, `trade_in_equity`, `negative_equity_rolled_in`; reconciliation check | stage_02, contracts §3.6, document diagram | P0 |
| CH-07 | 2 | Quote match + arithmetic only | Consistent-but-wrong extraction (S2-ISSUE-001, -002, RT-09) | Label co-location; deterministic TILA reader; offer chooser | stage_02 md/docx, contracts §3.5, document diagram | P0 |
| CH-08 | 2 | "Verify terms on the day" | Unpaid Gemini terms prohibit sensitive data (S2-ISSUE-008, RT-15) | `LLM_DATA_MODE` paid / synthetic_only / off; inline only | stage_02, system_architecture §9, ADR-022, risk R-17, deployment diagram | P0 |
| CH-09 | 1 | Single status precedence incl. `verified` | Confirmation ≠ verification (S1-ISSUE-002, S2-ISSUE-011, RT-10) | `status` × `verification` | contracts §2/§3.1/§3.5, all stage md, stage_06 chips | P0 |
| CH-10 | 1 | C03 conflict on expenses > income | Hardship rejected (S1-ISSUE-006, RT-04) | H01 deficit acknowledgement; `DEFICIT_*` flags | stage_01, stage_03, error diagram | P0 |
| CH-11 | 1 | Debts list without per-item status | Missing payments summed as 0 (S1-ISSUE-008, RT-03) | Debt sub-facts; blocking | stage_01, contracts §3.1 | P0 |
| CH-12 | 1 | Additive score; global T0 + τ stopping | Optional outranks required; stopping contradiction (S1-ISSUE-001, -003, -004, -005) | Lexicographic priority; `AnalysisReadiness`; sensitivity display-only | stage_01 md/docx, contracts §3.2/§3.4/§3.12, workflow diagram | P1 |
| CH-13 | 1 | Skips re-enter candidates | Loops (S1-ISSUE-010, RT-02) | `declined` terminal; estimates not auto-re-asked | stage_01, contracts §3.4 | P1 |
| CH-14 | 1/2/6 | Interview then upload | Serialized latency; unknown readiness (S1-ISSUE-011) | Two-track intake; offer extraction async | stage_01, stage_06, sequence diagram, data-flow diagram | P1 |
| CH-15 | 1 | No down-payment source | Reserve can't be computed correctly (S1-ISSUE-012) | `loan.down_payment_source` fact | stage_01, contracts | P1 |
| CH-16 | 1 | Range collapsed to one income | Low-month stress understated (S1-ISSUE-014, S4-ISSUE-008) | `income.low_month`; `sc_low_month` | stage_01, stage_04 | P1 |
| CH-17 | 3 | Assumed depreciation curve | Fabricated timeline (S3-ISSUE-010) | Equity at start always; timeline only from user estimates (closes Q-2) | stage_03, ADR-018 | P1 |
| CH-18 | 3 | Flags incl. PAYMENT_SHARE_GT_x | Ungrounded threshold; missing flags (S3-ISSUE-011) | Flags v1.1 list | stage_03, contracts §3.7 | P1 |
| CH-19 | 3 | "Total interest" = TOP − AF | Mislabel (S3-ISSUE-006, RT-14) | `finance_charge` vs `interest` | stage_03, stage_06 glossary, contracts | P1 |
| CH-20 | 3/1 | Dependency lists duplicated | Drift (S3-ISSUE-012) | Engine `required_inputs` map as single source | stage_01, stage_03, contracts §3.12 | P1 |
| CH-21 | 4 | "CFPB median" 3-week shocks | False citation (S4-ISSUE-001, RT-18) | Illustrative user-relative catalog; CFPB context line | stage_04 md/docx, contracts §3.8 | P0 |
| CH-22 | 4 | Negative savings balances | Implies free credit (S4-ISSUE-004) | Floor at 0 + unfunded gap | stage_04, contracts §3.8, simulation diagram | P1 |
| CH-23 | 4 | Single with-offer run | No attribution (S4-ISSUE-005) | Paired runs | stage_04, stage_06, contracts | P1 |
| CH-24 | 4 | Baseline == residual × 12 test | Fails on correct engine (S4-ISSUE-002) | Month-by-month equality | acceptance plan A-09r | P1 |
| CH-25 | 4 | Break-even edges undefined | Ambiguity (S4-ISSUE-006) | Deficit → 0% flag; capped; M = 3 and 6 (closes Q-4) | stage_04, contracts | P2 |
| CH-26 | 5 | APR −1 pt alternative | Unsupported option (S5-ISSUE-002, RT-12) | Removed; rate sensitivity statement (closes Q-3) | stage_05, contracts §3.9 | P0 |
| CH-27 | 5 | Down lever ignores savings | Hidden cost (S5-ISSUE-001, -008) | Re-run F13; objective savings-after-purchase | stage_05, contracts | P0 |
| CH-28 | 5 | Term changes unlabeled | Implied lender behavior (S5-ISSUE-003) | `same_rate_assumed` flag | stage_05, stage_06 | P1 |
| CH-29 | 5 | Price −x% and delay levers in MVP | Underspecified (S5-ISSUE-004, -005) | Deferred with input requirements | stage_05 | P2 |
| CH-30 | 5 | Competing offer = APR swap | Ignores fees/terms (S5-ISSUE-006) | Full verified LoanOffers only | stage_05 | P1 |
| CH-31 | 6 | Narration + numeric gate in MVP | Relational falsehoods pass (S6-ISSUE-001, RT-13) | Claim-based templates; narration deferred with claim-referenced spec | stage_06 md/docx, contracts §3.10, data-flow/sequence/high-level diagrams, ADR-023 | P0 |
| CH-32 | 6 | No synthesis view; no readiness UI | Cognitive load (S6-ISSUE-003, -004) | Key points; readiness panel | stage_06, contracts §3.11 | P1 |
| CH-33 | 6 | Chips say "verified" | Overclaim (S6-ISSUE-002) | Source + verification labels | stage_06 | P1 |
| CH-34 | 2 | Confidence shown in UI | Uncalibrated (S2-ISSUE-004) | Internal `model_self_report` only | stage_02, contracts §3.5 | P2 |
| CH-35 | 2 | Keyword product block | Negation false positives (S2-ISSUE-006) | Booleans with quotes; keyword → confirm | stage_02 | P1 |
| CH-36 | 2 | Manual entry unchecked | Typos pass (S2-ISSUE-007) | Same checks for manual offers | stage_02, error diagram | P1 |
| CH-37 | Sup. | Timeline from 17:00 start | Stale (current time 18:56 EDT) | Re-planned blueprint and execution plan | team_execution_plan.md, final_implementation_blueprint.md | P1 |
| CH-38 | Sup. | 3 LLM call types | Narration deferred | 2 call types in MVP | system_architecture, high-level diagram, ADR-003 note | P2 |
