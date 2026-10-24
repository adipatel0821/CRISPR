# Stage 06 — Explainable AI & Decision Experience

**Agent:** Stage Architecture Agent 6 · **Reviewed by:** Supervisor (Phase C: reviews with Agents 5 and 1) · **Contracts:** `supervisor/api_and_data_contracts.md` v1.0
**Research date:** 2026-10-24. ◻ = documentation URL known to the author, not re-fetched today.

---

## 1. Stage objective

Present the analysis so a first-time borrower understands their position, what the loan changes, what drives the result, what is unknown, and what alternatives exist — with every number traceable to its source and every AI-written sentence validated against the verified results.

## 2. Problem decomposition

Explanation architecture (what text comes from where) → grounding and validation (how AI prose is constrained) → information architecture (journey, screens) → visualization → missing-information and uncertainty UX → accessibility → testing.

## 3. Functional requirements

- FR1 Provenance chip on every displayed number: *You told us* · *From your document (p.N)* · *Calculated* · *Assumption* · *AI wording*.
- FR2 Template explanations exist for every report section; LLM narrative is optional and validated.
- FR3 "Why we ask" on every intake question; "What's missing" panel with *Ask the lender* prompts.
- FR4 Verification table for extracted terms with evidence quotes and conflict states.
- FR5 Dashboard sections: Now · With this loan · Under stress · Alternatives · Missing info · Report.
- FR6 Glossary tooltips (CFPB key terms) and "how this was calculated" drawers (formula ids).
- FR7 Clear non-advice framing throughout.

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

| Criterion (weight) | A | B | **C** | D |
|---|---|---|---|---|
| Correctness & reliability (25%) | 5 | 2 | 5 | 3 |
| Hackathon feasibility (20%) | 5 | 5 | 4 | 2 |
| Integration simplicity (15%) | 5 | 4 | 4 | 3 |
| Functional capability (15%) | 2 | 4 | 5 | 4 |
| Explainability (10%) | 5 | 2 | 5 | 4 |
| Performance & cost (10%) | 5 | 4 | 4 | 2 |
| Extensibility (5%) | 3 | 3 | 4 | 4 |
| **Weighted** | **4.45** | **3.45** | **4.50** | **3.00** |

*Sensitivity test (required: A and C within 0.05).* Raising feasibility to 30% (others scaled) flips the order to A 4.55 vs C 4.45. Resolution: **C with A as the mandatory first milestone** — templates ship in the vertical slice; narration is added only after the gate exists and tests pass. If time runs out, A is the delivered state with no loss of correctness. Frontend-stack matrix: Next.js+Tailwind+shadcn+Recharts 4.4 vs Vite SPA 4.0 (no routing/SSR conveniences, same libs) vs Streamlit 3.1 (fast but poor control over provenance UI and charts); decision robust.

## 9. Recommended architecture

- **Explanation engine (backend, Dev 4):** `explain/plan.py` builds an `ExplanationPlan` per section (facts, metrics, flags, assumptions, allowed numbers, citations); `explain/templates.py` renders deterministic text; `explain/narrate.py` calls the LLM with the plan and strict instructions; `explain/validate.py` enforces numeric membership + forbidden phrases + length; `ExplanationSection` carries both texts and `narrative_validated`.
- **Frontend (Dev 3):** Next.js App Router; routes `/start`, `/intake`, `/offer`, `/dashboard`, `/report`; server components fetch `DecisionReport`; client components for charts and interactive sliders; Zod schemas generated from the backend OpenAPI for type parity.

## 10. Detailed processing workflow (user journey)

1. **Start** — choose decision type; privacy notice (what goes to the AI provider; delete anytime); "use this with someone you trust" (CFPB pattern).
2. **Intake** — adaptive Q&A; each question shows `why_we_ask`, skip/estimate controls, progress as "what we can compute now"; typed widgets by default, free text optional.
3. **Offer** — upload document or enter terms; **verification table** (value · evidence quote · page · check status · confirm/edit/mark missing); unsupported-product block with explanation.
4. **Dashboard** — *Now* (income, essentials, debts, residual, reserve months) → *With this loan* (payment, total cost, residual change, LTV, flags with citations) → *Under stress* (scenario cards with runway; break-even drop; assumptions panel) → *Alternatives* (Pareto scatter; trade-off statements; constraint inputs) → *Missing info* (what's unknown, why it matters, ask-the-lender list).
5. **Report** — printable summary with provenance legend, citations and disclaimers; share nothing by default.

## 11. Algorithms and reasoning strategies

**Explanation plan → narrative → validation**
```
plan = {section_id, audience: "first-time borrower", facts:[{label, value, status}], metrics:[...], flags:[...],
        assumptions:[...], citations:[...], allowed_numbers: [all values formatted in 2–3 ways], forbidden:[...],
        style: "plain, ≤ 120 words, no advice, state assumptions"}
narrative = LLM(plan)                     # temperature 0.3, structured output {text}
ok = numbers(narrative) ⊆ allowed_numbers ∧ no forbidden phrases ∧ len ≤ limit ∧ no new comparatives ("best", "safe")
section.narrative_text = narrative if ok else None   # UI shows template_text when None
```
Number extraction: regex for currency, percentages, months; normalization (`$1,154.80`, `$1,155`, `about $1,150` → allowed if the plan includes the rounded variants it generated). Comparatives/advice phrases are a configurable deny-list; violations are logged with the plan hash for review.

**Provenance rendering:** chip color + icon + text label (not color alone); hover/tap opens the evidence (quote and page image region in enhanced scope, formula drawer for calculations, assumption text with citation).

**Contradiction prevention:** the UI never renders two sources for the same metric; all sections read from the single `DecisionReport` snapshot (`report_id`), and a stale-report banner appears if facts change (`profile_version` mismatch).

## 12. Data models and schemas

`ExplanationPlan`, `ExplanationSection` (contracts §3.10), `ProvenanceChip {kind, label, evidence_id}`, `GlossaryTerm {term, definition, cfpb_url}`, `Citation {id, title, url, accessed}`.

## 13. Inputs and outputs

Inputs: `DecisionReport`, glossary, config. Outputs: rendered screens; `POST /reports/{id}/explain` narratives; printable report (HTML print stylesheet; PDF export in enhanced scope).

## 14. API interaction requirements

All endpoints in contracts §4; polling for document extraction; optimistic UI for answers with server-confirmed facts.

## 15. Integration dependencies

Stage 1 (questions, why, completeness), Stage 2 (verification table), Stage 3/4/5 (report), Dev 4 (explain endpoint). Agent 6↔1 review outcome: the intake shows at most one question at a time plus the optional list; estimated facts render with an "estimate" badge and a one-tap "refine" action; questions never exceed 10 before "Run analysis" is offered.

## 16. Error and failure handling (failure & uncertainty UX)

| Situation | UX |
|---|---|
| LLM unavailable | templates only; subtle "AI wording unavailable" note; nothing else changes |
| Narrative failed validation | template shown; no user-facing error |
| Extraction failed / scan unreadable | manual entry form pre-filled with any verified fields |
| Conflicting terms | both values shown with evidence; user picks or edits |
| Missing T0 fact | dashboard section shows "needs: savings" with a one-tap question |
| Unsupported product | explanatory block + what we can still show (document terms) |
| Stale report | banner + re-run |

## 17. Security and privacy

No analytics SDKs; no third-party scripts beyond fonts; session token in memory + httpOnly cookie (if same-site deployment) — otherwise bearer header; delete-session button on every page; printed report excludes raw document pages.

## 18. Testing and evaluation

- **Validation gate tests:** 30 synthetic narratives (10 valid, 20 with injected wrong numbers/advice phrases) — gate must reject all 20.
- **Provenance coverage:** automated check that every numeric DOM node has a `data-evidence-id` (Playwright optional; at minimum a unit test on the render model).
- **Usability:** 3 hallway tests with a scripted persona; metrics: task completion (find total interest; find what's missing), time to first insight, misread rate on "is this a prediction?" question (target 0/3 say yes).
- **Accessibility:** axe-core run on 4 screens; keyboard-only walkthrough.
- **Readability:** template texts scored with `textstat` (◻ https://pypi.org/project/textstat/) ≤ grade 8.

## 19. Performance and cost estimates

One narration call per section on demand (≤ 6 sections × ~700 input / 150 output tokens); negligible cost; 1–3 s latency hidden by rendering templates first. Frontend bundle with Recharts ≈ 200–300 kB gzipped (estimate).

## 20. MVP, enhanced, and production scope

- **MVP:** 5 screens, provenance chips, verification table, templates for all sections, scenario cards, Pareto scatter, missing-info panel, glossary tooltips, print report.
- **Enhanced:** validated narration, evidence highlights on page images, sliders for scenarios/levers, PDF export, "explain this number" chat limited to plan content.
- **Production:** localization, user accounts and saved reports, consented data connections, A/B-tested comprehension, formal accessibility audit.

## 21. Architectural decision records

**ADR-S6-01 Explanation architecture** — Hybrid C with templates-first. Confidence: high.
**ADR-S6-02 Frontend stack** — Next.js + TypeScript + Tailwind + shadcn/ui + Recharts. Confidence: high.
**ADR-S6-03 No RAG/vector DB** — citations are structured; glossary is static. Confidence: high.
**ADR-S6-04 Non-advice framing** — deny-list + disclaimers + user control. Confidence: high.

## 22. Unresolved questions

- Print/PDF: browser print stylesheet (MVP) vs server PDF (enhanced) — owner Dev 3, checkpoint 2.
- Narration temperature and max words — defaults 0.3 / 120; tune after gate tests (owner Dev 4).

## 23. Source references

- CFPB Loan Estimate Explainer https://www.consumerfinance.gov/owning-a-home/loan-estimate/ ; Closing Disclosure explainer; Your Financial Path to Graduation; Auto loan key terms glossary https://www.consumerfinance.gov/consumer-tools/auto-loans/answers/key-terms/ — project CFPB research file (2026-10-24)
- Next.js ◻ https://nextjs.org/docs · Tailwind ◻ https://tailwindcss.com/docs · shadcn/ui ◻ https://ui.shadcn.com/docs · Recharts ◻ https://recharts.org/ · visx ◻ https://airbnb.io/visx/
- WCAG 2.1 ◻ https://www.w3.org/TR/WCAG21/ · axe-core ◻ https://github.com/dequelabs/axe-core · textstat ◻ https://pypi.org/project/textstat/
- Winton Centre for Risk and Evidence Communication ◻ https://wintoncentre.maths.cam.ac.uk/
- Jacovi & Goldberg, "Towards Faithfully Interpretable NLP Systems" (ACL 2020) — faithful vs plausible explanations; paper reference, not re-verified online today.
