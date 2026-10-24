# Evidence Register

Classes: **VF** verified fact (source fetched on the stated date) · **MR** established mathematical relationship (derivable and reproduced) · **DA** design assumption (our choice, labeled in UI or config) · **UD** unverified dependency (must be checked at implementation) · **AE** architectural estimate (not measured).

## Verified facts

| ID | Claim | Source | Verified |
|---|---|---|---|
| VF-01 | Devpost: submissions must be created by midnight Saturday; hard deadline Sunday 12:00 noon; edits until 1:45 PM; ≤ 5-min video; public repo preferred; all members listed; one member presents | https://hackpsu-fall-2026.devpost.com/ | 2026-10-24 (twice) |
| VF-02 | Official judging criteria: Implementation, Clarity, Creativity (incl. "beyond an API wrapper"), Growth, Impact | same | 2026-10-24 |
| VF-03 | Gemini structured output supports JSON Schema / Pydantic schemas | https://ai.google.dev/gemini-api/docs/structured-output | 2026-10-24 |
| VF-04 | Gemini PDF understanding: up to 1,000 pages; 258 tokens/page; inline requests ≤ 20 MB; File API storage 48 h | https://ai.google.dev/gemini-api/docs/document-processing | 2026-10-24 |
| VF-05 | Gemini unpaid services: content may be used to improve Google products; human reviewers may read inputs and outputs; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Paid services: prompts and responses are not used to improve products | https://ai.google.dev/gemini-api/terms | 2026-10-24 |
| VF-06 | Gemini API terms: not to be used in services directed to or likely accessed by people under 18 | https://ai.google.dev/gemini-api/terms (archive copy reviewed) | 2026-10-24 |
| VF-07 | Reg Z §1026.18(b): amount financed = principal loan amount or cash price less down payment + other financed amounts not part of the finance charge − prepaid finance charge; fees may be included in the principal at the creditor's option | https://www.consumerfinance.gov/rules-policy/regulations/1026/18/ ; https://www.law.cornell.edu/cfr/text/12/1026.18 | 2026-10-24 |
| VF-08 | CFPB MEM (2022): consumers grouped as no emergency savings / less than one month of income / more | https://files.consumerfinance.gov/f/documents/cfpb_mem_emergency-savings-financial-security_report_2022-3.pdf | 2026-10-24 |
| VF-09 | CFPB research (Fulford & Low): significant expense shocks are more common than significant income drops; average share of income lost to unexpected expenses when they occur ≈ 15% | https://conference.nber.org/conf_papers/f211720/f211720.pdf | 2026-10-24 (context use only; exact wording to be re-read before slides) |
| VF-10 | CFPB en-753 term table; auto loan worksheet; en-727/759/769/797/2132 guidance | Project CFPB research file (scraped 2026-10-24); URLs listed in stage docs | 2026-10-24 (secondary) |

## Established mathematical relationships (reproduced in `verify.py`, 2026-10-24)

| ID | Relationship | Result |
|---|---|---|
| MR-01 | Annuity payment with cents rounding and final-payment residue reproduces CFPB en-753 ($20,000 @ 4.75%) and worksheet ($15,800 @ 3.5%/48) | exact |
| MR-02 | Payment must be computed on principal; $20,000 note, $500 PFC → $375.14 (vs $365.76 on AF) | reproduced |
| MR-03 | APR solved on AF = $19,500 → 5.796%; on AF − PFC → 6.879% (wrong) | reproduced |
| MR-04 | Trade-in: user's economic contribution is equity (TV − TP), not TV | reproduced (two cases) |
| MR-05 | Reserve after purchase must subtract cash down drawn from savings | reproduced (1.27 → 0.32 months) |
| MR-06 | Replaced vehicle costs must be netted out | reproduced ($260/mo) |
| MR-07 | Min savings over the horizon is monotone non-increasing in the income-drop fraction, so bisection for break-even is valid | derivation (stage_04 review §5) |
| MR-08 | 12-month sum ≠ 12 × month-1 residual when debts end mid-horizon | reproduced |

## Design assumptions (must be labeled where shown)

| ID | Assumption | Where labeled |
|---|---|---|
| DA-01 | Scenario catalog sizes (1 month of essentials expense; −25% × 3 months; 0 income × 2 months; +20% vehicle costs) are illustrative | Assumptions panel, scenario cards |
| DA-02 | OAT delta ±10% | Sensitivity drawer |
| DA-03 | Break-even horizons M = 3 and 6 months | Resilience card |
| DA-04 | `a_pfc_zero` when PFC is unknown | Verify screen, key points if relevant |
| DA-05 | Term alternatives at the same rate | Alternative cards (`same_rate_assumed`) |
| DA-06 | Unfunded gap carries no interest | Stress drawer |
| DA-07 | Refinement question order (curated) | "How we decide what to ask" panel |
| DA-08 | Payment mismatch tolerance ±$1.00 | Verify screen |

## Unverified dependencies (check at implementation)

| ID | Dependency | Owner | When |
|---|---|---|---|
| UD-01 | Current Gemini Flash-tier model string and free/paid rate limits | Dev 2 | before CP1 |
| UD-02 | Whether the team enables billing (paid mode) or demos in synthetic-only mode | Team lead / Dev 4 | before CP1 |
| UD-03 | Pinned versions of all libraries (≥ 2 weeks old) | each dev | CP0 |
| UD-04 | Exact wording of CFPB context sentences for slides | Dev 4 | before video |

## Architectural estimates (not measured)

Engine evaluation ≈ 1–2 ms; scenario catalog with paired runs < 20 ms; alternatives grid ≤ 120 in < 1 s; extraction 5–15 s per 6-page text PDF. All to be measured during implementation; none may be presented as results.

## Retracted claims from v1.0

- "CFPB median shock (3 weeks of income, more than once per year)": **retracted**, not supported.
- "Validated narration": **retracted for the MVP**; the numeric gate doesn't validate claims.
- "Verified terms" meaning user-confirmed: **relabeled**.
