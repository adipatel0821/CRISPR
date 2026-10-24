# Stage 06 — Explainable AI & Decision Experience

> **Version 1.1 (post-audit, 2026-10-24).** Revised per `reviews/stage_06_review.md` (verdict REVISE; LLM narration DEFERRED). The numeric-membership gate can't catch false relationships between permitted numbers, so the MVP uses **claim-based deterministic explanations**. The deferred LLM narration must cite claim ids and pass relational checks (CH-31). Also: key points first (CH-32), readiness panel (CH-32), chips that separate source from verification (CH-33), paired stress cards (CH-23), two-track intake (CH-14), data-mode banner (CH-08).

**Agent:** Stage Architecture Agent 6 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 5 and 1) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.1 (authoritative schemas)
**Research date:** 2026-10-24. ◻ = documentation URL known to the author, not re-fetched today.

---

## 1. Stage objective

Present the analysis so a first-time borrower understands their position, what the loan changes, what drives the result, what is unknown, and what alternatives exist — with every number traceable to its source and every AI-written sentence validated against the verified results.

## 2. Problem decomposition

Explanation architecture (what text comes from where) → grounding and validation (how AI prose is constrained) → information architecture (journey, screens) → visualization → missing-information and uncertainty UX → accessibility → testing.

## 3. Functional requirements

- FR1 Provenance and verification chip on every number: *You told us* · *You confirmed* · *From your contract, p.N · matched* · *Calculated* · *Assumption* · *Estimate*. No chip says "verified".
- FR2 Every explanation sentence is rendered from a typed claim (contracts §3.10). No free-form generated text in the MVP.
- FR3 Readiness panel: per analysis, available or "needs: X" with a one-tap question.
- FR4 Verification table with label + value + quote, check states, two-candidate conflicts, offer chooser, payment-mismatch explanation.
- FR5 Key points (three ranked claims) before the detailed sections: with this loan, under stress (paired), alternatives, missing info and ask-the-lender, assumptions.
- FR6 Glossary tooltips (CFPB key terms; finance charge vs interest) and "how this was calculated" drawers.
- FR7 Non-advice framing; data-mode banner.

## 4. Nonfunctional requirements

First contentful paint of the dashboard < 2 s on a laptop; charts readable at 360 px width; WCAG 2.1 AA contrast; keyboard navigable; plain-language target (Flesch-Kincaid ≤ grade 8 for template text, measured); no number appears in UI that is not in the report JSON.

## 5. Data requirements

`DecisionReport` (contracts §3.11), glossary JSON (27 CFPB key terms, project file §2), citation table (CFPB URLs), config assumptions endpoint.

## 6. Research findings

- **Explainable systems for decision support** favour *faithful* explanations (derived from the actual computation) over *plausible* ones (generated post hoc). Our computations are deterministic, so faithful explanations are cheap: templates keyed by `formula_id` and flag ids. The LLM's role is readability, not reasoning.
- **Numeric hallucination control.** A narrative generated from a structured "explanation plan" that lists every allowed number, then validated by extracting all numerals/percentages from the output and checking membership (after formatting normalization), is a simple, testable gate. Failure ⇒ template text. Same pattern for forbidden phrases ("you should take", "you can afford", "safe", "guaranteed").
- **Uncertainty communication.** Research on risk communication (e.g., the Winton Centre's guidance on communicating uncertainty) recommends stating what is assumed, using absolute numbers over relative, and avoiding false precision — hence "about $147 left in a typical month" rather than "$146.78", with the exact figure in the drawer. (◻ https://wintoncentre.maths.cam.ac.uk/)
- **CFPB UX patterns to copy** (project file): Loan Estimate Explainer's click-a-field "Actions to take / Definitions to know" and "This feature is risky" labels; Grad Path's "Ask the school" for missing data and "use this tool with someone you trust"; credit-card minimum-payment disclosure as a long-horizon display precedent.
- **Frontend stack.** Next.js App Router with TypeScript (◻ https://nextjs.org/docs), Tailwind CSS (◻ https://tailwindcss.com/docs), shadcn/ui (◻ https://ui.shadcn.com/docs — copy-in components, accessible primitives via Radix), Recharts (◻ https://recharts.org/) for bar/line/scatter/composed charts. Visx (◻ https://airbnb.io/visx/) is more flexible but requires hand-built scales/axes — more time than the demo warrants.
- **Accessibility.** WCAG 2.1 AA (◻ https://www.w3.org/TR/WCAG21/): contrast ≥ 4.5:1, non-color encodings (patterns/labels), focus order, chart data tables as alternatives.

## 7. Alternatives investigated (explanation architecture)

| Option | Strengths | Weaknesses |
|---|---|---|
| A. Template-only | Fully faithful; zero LLM risk; fastest | Stilted prose; weaker for "why does this matter to me" |
| B. LLM free-form from results JSON | Fluent | Unverifiable numbers; contradictions; false confidence |
| **C. Hybrid: templates as ground truth + LLM narration from an explanation plan + numeric/phrase validation gate (recommended)** | Faithful *and* readable; graceful fallback | Extra validation code; LLM latency on first render |
| D. RAG over CFPB corpus for all explanations | Rich citations | Retrieval errors; no need: our citations are already structured; adds a vector store |

## 8. Comparative decision matrix

| Criterion (weight) | A Template-only | B LLM free-form | C Hybrid + numeric gate (v1.0) | **C′ Claim-based templates (v1.1)** | D RAG |
|---|---|---|---|---|---|
| Correctness & reliability (25%) | 5 | 2 | 3 | 5 | 3 |
| Hackathon feasibility (20%) | 5 | 5 | 4 | 5 | 2 |
| Integration simplicity (15%) | 5 | 4 | 4 | 5 | 3 |
| Functional capability (15%) | 2 | 4 | 5 | 3 | 4 |
| Explainability (10%) | 5 | 2 | 4 | 5 | 4 |
| Performance & cost (10%) | 5 | 4 | 4 | 5 | 2 |
| Extensibility (5%) | 3 | 3 | 4 | 4 | 4 |
| **Weighted** | **4.45** | **3.45** | **3.90** | **4.65** | **3.00** |

*v1.1 rescoring:* C's correctness drops from 5 to 3 because its gate can't detect relational falsehoods (S6-ISSUE-001). C′ (claims + templates) captures the benefit of structure without generation risk, and it is the base onto which deferred claim-referenced narration can later be added. The frontend stack matrix is unchanged.

## 9. Recommended architecture

- **Claim builder (backend, Dev 4):** `explain/claims.py` turns the `DecisionReport` into typed claims (value, change, comparison, threshold_flag, scenario_outcome, missing) with evidence and assumption ids. `explain/templates.py` renders each claim; `explain/key_points.py` ranks three claims (cost, monthly change, most severe flag or stress outcome).
- **Deferred narration (spec only):** the LLM receives claims and returns `sentences[{text, claim_ids[]}]`. The validator checks number membership per cited claim, direction words vs `direction`, metric-name synonyms vs `subject_metric`, citation coverage and the deny-list. Any failure falls back to the template. It is enabled only after A-40 passes.
- **Frontend (Dev 3):** Next.js App Router; routes `/start`, `/intake` (two-track with offer status and readiness panel), `/offer` (verification), `/dashboard` (key points + sections), `/report`. Zod types generated from OpenAPI v1.1. A single number formatter: headlines rounded with "about"; drawers in cents.

## 10. Detailed processing workflow (user journey)

1. **Start:** privacy notice and data-mode banner; choose "Upload a loan offer" / "Type the terms" / "Explore without an offer".
2. **Intake:** one question at a time with `why_we_ask`, skip, decline ("I'd rather not say") and estimate. The offer status card runs in parallel; readiness chips per analysis.
3. **Offer:** verification table; offer chooser if needed; payment-mismatch explanation; unsupported-product block.
4. **Dashboard:** key points first. Then *With this loan* (payment, finance charge, total paid through the deal with breakdown, monthly left before → after, savings after purchase, flags with citations), *Under stress* (paired cards, break-even 3/6 months, assumptions), *Alternatives* (Pareto scatter, trade-off claims with flags, rate sensitivity, constraints), *Missing info* (ask-the-lender list), *Assumptions*.
5. **Report:** printable; provenance legend; citations; disclaimers.

## 11. Algorithms and reasoning strategies

**Claims → templates.** Each claim type has templates keyed by `subject_metric` and flag id. Wording rules: no "afford", "safe", "should", "best", "better" or "recommend"; scenario claims always say "In this illustrative scenario"; comparison claims include their `assumption_flags` ("if offered at the same rate").

**Provenance rendering.** Chips combine source and verification (FR1); hover or tap shows evidence (quote and page), the formula drawer, or assumption text.

**Consistency.** All sections read one `DecisionReport` snapshot; a stale-report banner appears on a `profile_version` mismatch; one formatter is used everywhere.

## 12. Data models and schemas

Contracts v1.1 §3.10–3.12: `Claim`, `ExplanationEvidence` (with verification), `ExplanationSection` (`claims[]`, `template_text`, reserved `narrative_text = null`), `DecisionReport` (`key_points`, `readiness`, `data_mode`), `GlossaryTerm`, `Citation`.

## 13. Inputs and outputs

Inputs: `DecisionReport` v1.1, readiness, glossary, config assumptions. Outputs: rendered screens and a printable report (HTML print stylesheet). No narration in the MVP.

## 14. API interaction requirements

All endpoints in contracts v1.1 §4, including `/readiness`. `POST /reports/{id}/explain` returns 501 in the MVP (deferred).

## 15. Integration dependencies

Stage 1 (questions, `why_we_ask`, readiness, refinements, declines), Stage 2 (verification states, chooser, mismatch), Stages 3–5 (report metrics, flags, paired scenarios, alternatives with flags, rate sensitivity), Dev 4 claim builder. Agent 6↔1 outcome (v1.1): one question at a time; core questioning ends at readiness; refinements optional; estimates badged with "refine".

## 16. Error and failure handling (failure & uncertainty UX)

| Situation | UX |
|---|---|
| LLM unavailable or data mode ≠ paid | Typed widgets; manual offer entry; "Demo mode: sample documents only" banner when `synthetic_only` |
| Analysis unavailable | Readiness panel: what's needed, one-tap question |
| Extraction failed or scan in MVP | Manual entry form pre-filled with any matched fields |
| Conflicting term (reader disagreement) | Both candidates with evidence; user picks or edits |
| Payment mismatch | Explanation (financed fees or an irregular first period) and the difference |
| Deficit | Key point #1 in neutral wording |
| Unsupported product | Explanation plus the terms we can still show |
| Stale report | Banner + re-run |

## 17. Security and privacy

No analytics SDKs; no third-party scripts beyond fonts; session token in memory + httpOnly cookie (if same-site deployment) — otherwise bearer header; delete-session button on every page; printed report excludes raw document pages.

## 18. Testing and evaluation

- A-12r claim fidelity: every rendered sentence maps to ≥ 1 claim; every numeric node has an evidence id.
- A-41 key points reproducible from report values. A-42 no chip says "verified".
- A-40 (only before enabling deferred narration): 20 adversarial narratives (misattribution, wrong direction, false causation, implied affordability), all rejected.
- Usability: 3 hallway tests reported as qualitative observations with n = 3 (no percentages).
- Accessibility: axe-core on 4 screens; keyboard walkthrough. Readability of templates ≤ grade 8 (`textstat`).

## 19. Performance and cost estimates

No LLM latency in the report path (narration deferred); claim building is milliseconds. Frontend bundle with Recharts ≈ 200–300 kB gzipped (estimate).

## 20. MVP, enhanced, and production scope

- **MVP:** five screens, claims and templates, key points, readiness panel, chips with verification, verification table with chooser, paired stress cards, alternatives scatter with flags, missing-info, print report, data-mode banner.
- **Enhanced:** claim-referenced LLM narration (after A-40), evidence highlights on page images, sliders, PDF export.
- **Production:** localization, accounts, comprehension studies, formal accessibility audit.

## 21. Architectural decision records

**ADR-S6-01 Explanation architecture** — v1.0: hybrid C with templates first. **Superseded by ADR-S6-05 (v1.1).**
**ADR-S6-02 Frontend stack** — Next.js + TypeScript + Tailwind + shadcn/ui + Recharts. Confidence: high.
**ADR-S6-03 No RAG/vector DB** — citations are structured; glossary is static. Confidence: high.
**ADR-S6-05 (v1.1) Claim-based explanations; narration deferred** — numeric gates can't validate relationships; claims make every sentence traceable. Confidence: high. (ADR-023.)
**ADR-S6-04 Non-advice framing** — deny-list + disclaimers + user control. Confidence: high.

## 22. Unresolved questions

- Print stylesheet (MVP) vs server PDF (enhanced): Dev 3 at CP2.
- Narration temperature and limits: moot until the deferred feature is enabled.

## 23. Source references

- CFPB Loan Estimate Explainer https://www.consumerfinance.gov/owning-a-home/loan-estimate/ ; Closing Disclosure explainer; Your Financial Path to Graduation; Auto loan key terms glossary https://www.consumerfinance.gov/consumer-tools/auto-loans/answers/key-terms/ — project CFPB research file (2026-10-24)
- Next.js ◻ https://nextjs.org/docs · Tailwind ◻ https://tailwindcss.com/docs · shadcn/ui ◻ https://ui.shadcn.com/docs · Recharts ◻ https://recharts.org/ · visx ◻ https://airbnb.io/visx/
- WCAG 2.1 ◻ https://www.w3.org/TR/WCAG21/ · axe-core ◻ https://github.com/dequelabs/axe-core · textstat ◻ https://pypi.org/project/textstat/
- Winton Centre for Risk and Evidence Communication ◻ https://wintoncentre.maths.cam.ac.uk/
- Jacovi & Goldberg, "Towards Faithfully Interpretable NLP Systems" (ACL 2020) — faithful vs plausible explanations; paper reference, not re-verified online today.
