# DecisionTwin Architecture — Two-Page Summary (v1.1)

**Project:** DecisionTwin, an AI-assisted financial decision tool for HackPSU Fall 2026 (FNB Challenge, Nittany AI Challenge). **Date:** October 24, 2026. **Scope:** architecture only; no application code. **Verdict:** ready for implementation with nonblocking limitations.

## What was done

**v1.0 design.** Six scoped research passes (the chat environment can't spawn subagents) produced stage architectures, shared contracts, decision records, risks, tests, a team plan and nine diagrams. Devpost deadlines were verified: the project must be *created* by Saturday midnight, the hard deadline is Sunday noon, and a five-minute video and public repo are required.

**v1.1 audit.** Each stage was then reviewed in sequence, followed by a supervisor synthesis and a separate red-team pass that tried to make the system ask irrelevant questions, double-count costs, understate borrowing cost, accept a wrong extraction, or make an affordability claim. Findings were checked against primary sources fetched that day and reproduced in a small research script. The most important corrections:

1. **Loan math.** The payment was computed on the amount financed instead of the principal. With $500 of financed fees on $20,000 at 4.75% for 60 months, that understates the payment by $9.38 a month (Reg Z §1026.18(b)). The APR formula subtracted fees twice (6.88% instead of 5.80%). Total cost counted a trade-in's full value instead of its equity.
2. **Household math.** Reserve ignored cash leaving savings for the down payment (1.27 vs 0.32 months). The new car's costs were added on top of the current car's costs it replaces.
3. **Privacy.** Gemini's unpaid tier may use content to improve Google products, with human review, and says not to submit personal data. Real documents now require paid quota; otherwise the demo uses sample contracts.
4. **Document trust.** A wrong extraction can be perfectly self-consistent, so a label check, an independent rule-based reader of the federal disclosure box, and an offer chooser were added.
5. **Questioning.** Optional questions could outrank required ones, and the stop rule contradicted its own example. Now each analysis has explicit readiness, required questions come first, and spending more than you earn is acknowledged rather than rejected as bad data.
6. **Honesty.** A "CFPB median shock" figure couldn't be substantiated and was retracted; scenarios are now labeled illustrative. A hypothetical lower interest rate was removed from the alternatives. AI-written narration was deferred because a numbers-only check can't catch false claims; explanations are templates built from computed facts.

**Final architecture.** Next.js frontend and FastAPI backend with six in-process modules, one SQLite database, and two AI calls (answer parsing, document extraction), each with a non-AI fallback. The plan was re-anchored to the actual time: start 19:45, working slice by 23:00, Devpost entry by 23:30, code freeze 08:45, submit by 11:00.

## What each file contains

| File | Contents |
|----------|--------------------------------|
| `README.md` | Reading order, process disclosure, verification status, deliverable index |
| `SUMMARY.md`, `SUMMARY.pdf` | This summary |
| `stage-01-…/` (.md, .docx) | Questioning: ontology, readiness, question priority, rules, persona paths |
| `stage-02-…/` (.md, .docx) | Documents: extraction, evidence and label checks, independent reader, data mode |
| `stage-03-…/` (.md, .docx) | Engine: corrected formulas F00–F14, flags, reference tests |
| `stage-04-…/` (.md, .docx) | Scenarios: illustrative catalog, paired runs, break-even |
| `stage-05-…/` (.md, .docx) | Alternatives: actionable levers, Pareto trade-offs |
| `stage-06-…/` (.md, .docx) | Experience: claim-based explanations, screens, labels |
| `system_architecture.md` | Final architecture, AI boundaries, security, deployment |
| `api_and_data_contracts.md` | The only authoritative schemas and endpoints (v1.1) |
| `architecture_decisions.md` | Decision records ADR-001 to ADR-023 |
| `integration_risk_register.md` | Dependencies, open questions, 22 rated risks |
| `mvp_acceptance_plan.md` | Tests A-01 to A-42 with owners and checkpoints |
| `team_execution_plan.md` | Roles, schedule, checkpoints, cut list, demo script |
| `master_technical_specification.docx` | Consolidated Word spec for all four developers |
| `reviews/` (12 files) | Baseline, six stage reviews, final review with red team, change matrix, readiness checklist, evidence register, implementation blueprint |
| `diagrams/` (9 .mmd) | System, data flow, dependency graph, question flow, document flow, computation, sequence, deployment, error recovery |

All diagrams pass the Mermaid parser, all Word files render, and a consistency script found no conflicting identifiers across 23 documents.
