# Devpost draft — DecisionTwin (edit freely; numbers must match the live demo)

**Project name:** DecisionTwin
**Tagline:** See what a car loan really costs you — and what it does to your month and your savings — before you sign.
**Repo:** https://github.com/adipatel0821/CRISPR (branch `decisiontwin-implementation`)
**Tracks to select:** FNB Challenge — Trust, Decisions & Financial Confidence · Nittany AI Challenge · Grand Prize

## Inspiration
Car buyers are sold on the monthly payment. The figures that matter — total finance charge, what is left of your paycheck, how much of your emergency savings the down payment consumes — are spread across a contract, a dealer worksheet and your own budget. AI chat tools will happily give advice, but you can't tell which numbers to trust.

## What it does
- **Adaptive intake:** asks only the questions the selected analyses still need, explains why each question matters, and accepts "I'd rather not say" without blocking the rest. A budget deficit is acknowledged once, not treated as an error.
- **Loan offer:** manual entry or a (synthetic) TILA contract PDF. Every extracted term shows its source quote, page and independent checks; you confirm or correct it.
- **Real cost:** monthly payment, total of payments, finance charge vs. interest, total paid through the deal (with trade-in equity), APR re-check — exact decimal arithmetic that reproduces CFPB reference examples to the cent.
- **Your month & savings:** take-home left before vs. after, net of the car you're replacing; savings after the down payment and months of reserve.
- **Illustrative stress tests:** the same shock run with and without the loan, with savings floored at zero and unfunded gaps shown. Every scenario is labeled illustrative, never presented as a forecast.
- **Feasible alternatives:** more down (it also lowers your savings), other terms (labeled "same rate assumed"), dropping optional add-ons. Pareto-ranked; never an invented "lower APR" offer.
- **Explainable report:** every sentence comes from a claim, and every number links to its source: what you told us, the document, a formula, or a stated assumption. The word "verified" is never used for self-reported data.

## How we built it
Next.js + TypeScript + Tailwind + shadcn/ui + Recharts → FastAPI + Pydantic v2 → modular Python core: NetworkX dependency graph + YAML ontology (intake), PyMuPDF + deterministic TILA reader + Gemini behind a data-mode gate (documents), a Python `Decimal` engine (formulas F00–F14), paired scenario simulator, counterfactual grid with Pareto front, and a claim-based explanation builder. SQLite via SQLModel. Gemini only sees synthetic fixtures unless paid-tier terms are confirmed (`LLM_DATA_MODE`).

## Challenges
Getting the loan math right: payment on the note principal but APR on the amount financed, never double-counting prepaid finance charges, and trade-in equity vs. negative equity rolled in. Making "unknown" different from "zero" everywhere.

## Accomplishments
(fill in from implementation/TEST_RESULTS.md — real pass counts only)

## What we learned / What's next
Paid-tier document extraction for real contracts, scanned documents, odd first periods, lender-quote comparison.

## Built with
python, fastapi, pydantic, sqlmodel, sqlite, networkx, pymupdf, gemini, nextjs, typescript, tailwindcss, shadcn-ui, recharts
