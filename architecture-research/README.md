# DecisionTwin — Architecture Research & Design (HackPSU Fall 2026)

**Status:** architecture and documentation phase complete · **Date:** 2026-10-24 · **No application code was written.**
**Tracks:** FNB Challenge (Trust, Decisions & Financial Confidence) · Nittany AI Challenge · (MLH Best Use of Gemini API, if applicable)

## Read in this order

0. `SUMMARY.md` / `SUMMARY.pdf` — two-page overview of the work and every file.
1. `supervisor/system_architecture.md` — the decision, the stack, the Phase D challenge, and the final review summary.
2. `supervisor/team_execution_plan.md` — verified deadlines, roles, time budget, vertical slice, cut list.
3. `supervisor/api_and_data_contracts.md` — the schemas every developer codes against (frozen v1.0).
4. Your stage document (`stage-0X-*/stage_0X_architecture.md`) and its Word companion (`stage_0X_technical_stack.docx`).
5. `supervisor/mvp_acceptance_plan.md` — the tests that define "done."
6. `supervisor/integration_risk_register.md`, `supervisor/architecture_decisions.md`.
7. `diagrams/*.mmd` — paste into any Mermaid renderer (GitHub, VS Code, mermaid.live).

## Process disclosure (required by the assignment)

- This session ran in claude.ai chat, which **has no subagent-delegation capability**. The six Stage Agents were therefore executed as **six separately scoped research passes** against the Phase A contracts, followed by **one Supervisor synthesis pass**. Cross-agent reviews (Phase C) were performed as explicit pairwise checks and their outcomes are recorded in `system_architecture.md §6` and `api_and_data_contracts.md §7`.
- Web verification performed today (✅): HackPSU Fall 2026 Devpost page (deadlines, rules, judging criteria, sponsor tracks); Gemini API structured-output documentation; Gemini API document-understanding documentation. CFPB figures come from the project's CFPB research file (scraped 2026-10-24); the AI-extracted PDF figures it flags must be checked in the PDFs before they go on slides.
- Not re-fetched today (◻): framework documentation URLs (NetworkX, PyMuPDF, FastAPI, Next.js, Recharts, Python `decimal`, Reg Z pages). They are cited as known documentation locations, not as verified-today facts. Textbook references are labeled as such.
- Computational verification performed today: the Stage 3 formulas reproduce the CFPB en-753 term table and the CFPB auto-loan worksheet example exactly; the APR solver was checked on a worked example.
- The Part 10 decision-matrix weights are the assignment's research weights, **not** HackPSU judging criteria. The official criteria (Implementation, Clarity, Creativity, Growth, Impact) are quoted in the execution plan.

## Deliverable index

| Path | Type | Status |
|---|---|---|
| `README.md` | Markdown | ✅ |
| `SUMMARY.md` | Two-page summary (Markdown) | ✅ |
| `SUMMARY.pdf` | Two-page summary (typeset, 2 pages) | ✅ |
| `stage-01-knowledge-graph/stage_01_architecture.md` | Markdown (23 sections) | ✅ |
| `stage-01-knowledge-graph/stage_01_technical_stack.docx` | Word | ✅ |
| `stage-02-document-intelligence/stage_02_architecture.md` | Markdown | ✅ |
| `stage-02-document-intelligence/stage_02_technical_stack.docx` | Word | ✅ |
| `stage-03-financial-modeling/stage_03_architecture.md` | Markdown | ✅ |
| `stage-03-financial-modeling/stage_03_technical_stack.docx` | Word | ✅ |
| `stage-04-risk-simulation/stage_04_architecture.md` | Markdown | ✅ |
| `stage-04-risk-simulation/stage_04_technical_stack.docx` | Word | ✅ |
| `stage-05-counterfactual-intelligence/stage_05_architecture.md` | Markdown | ✅ |
| `stage-05-counterfactual-intelligence/stage_05_technical_stack.docx` | Word | ✅ |
| `stage-06-explainable-ai/stage_06_architecture.md` | Markdown | ✅ |
| `stage-06-explainable-ai/stage_06_technical_stack.docx` | Word | ✅ |
| `supervisor/system_architecture.md` | Markdown | ✅ |
| `supervisor/master_technical_specification.docx` | Word | ✅ |
| `supervisor/api_and_data_contracts.md` | Markdown | ✅ |
| `supervisor/team_execution_plan.md` | Markdown | ✅ |
| `supervisor/architecture_decisions.md` | Markdown | ✅ |
| `supervisor/integration_risk_register.md` | Markdown | ✅ |
| `supervisor/mvp_acceptance_plan.md` | Markdown | ✅ |
| `diagrams/high_level_architecture.mmd` | Mermaid (A) | ✅ parses |
| `diagrams/complete_data_flow.mmd` | Mermaid (B) | ✅ parses |
| `diagrams/financial_knowledge_graph.mmd` | Mermaid (C) | ✅ parses |
| `diagrams/adaptive_question_workflow.mmd` | Mermaid (D) | ✅ parses |
| `diagrams/document_intelligence_flow.mmd` | Mermaid (E) | ✅ parses |
| `diagrams/financial_simulation_architecture.mmd` | Mermaid (F) | ✅ parses |
| `diagrams/end_to_end_sequence.mmd` | Mermaid (G) | ✅ parses |
| `diagrams/deployment_architecture.mmd` | Mermaid (H) | ✅ parses |
| `diagrams/error_recovery_flow.mmd` | Mermaid (I) | ✅ parses |

All DOCX files were generated with docx-js and render-checked via LibreOffice. All nine Mermaid sources were validated with the Mermaid parser (headless); rendered SVGs were not produced because no browser is available in this environment — any Mermaid-capable viewer will render them.

## Missing or failed deliverables

None. Three architecture decisions remain open with owners and deadlines (see `system_architecture.md §17`): the Gemini model string/quota, the negative-equity depreciation assumption, and whether to include the hypothetical lower-rate alternative.
