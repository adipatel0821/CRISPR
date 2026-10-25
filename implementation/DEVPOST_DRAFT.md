# Devpost draft: DecisionTwin (edit freely; numbers must match the live demo)

**Project name:** DecisionTwin
**Tagline:** See what a car loan really costs you, and what it does to your month and your savings, before you sign.
**Repo:** https://github.com/adipatel0821/CRISPR (branch `decisiontwin-implementation`)
**Tracks to select:** FNB Challenge: Trust, Decisions & Financial Confidence · Nittany AI Challenge · Grand Prize

## Inspiration
Car buyers are sold on the monthly payment. The figures that matter are spread across a contract, a dealer worksheet and your own budget: the total finance charge, what is left of your paycheck, and how much of your emergency savings the down payment uses up. AI chat tools will happily give advice, but you can't tell which numbers to trust.

## What it does
- **Adaptive intake:** asks only the questions the selected analyses still need, explains why each question matters, and accepts "I'd rather not say" without blocking the rest. A budget deficit is acknowledged once, not treated as an error.
- **Loan offer:** manual entry or a (synthetic) TILA contract PDF. Every extracted term shows its source quote, page and independent checks; you confirm or correct it.
- **Real cost:** monthly payment, total of payments, finance charge vs. interest, total paid through the deal (with trade-in equity), and an APR re-check. Exact decimal arithmetic that reproduces CFPB reference examples to the cent.
- **Your month & savings:** take-home left before vs. after, net of the car you're replacing; savings after the down payment and months of reserve.
- **Illustrative stress tests:** the same shock run with and without the loan, with savings floored at zero and unfunded gaps shown. Every scenario is labeled illustrative, never presented as a forecast.
- **Feasible alternatives:** more down (it also lowers your savings), other terms (labeled "same rate assumed"), dropping optional add-ons. Pareto-ranked; never an invented "lower APR" offer.
- **Explainable report:** every sentence comes from a claim, and every number links to its source: what you told us, the document, a formula, or a stated assumption. The word "verified" is never used for self-reported data.

## Why car loans first
We started with car loans on purpose. A car loan is one of the biggest money decisions students and first-time buyers make, and it is where the classic traps live: shopping by monthly payment, long terms, add-ons, and rolling an old loan into a new one.

Car loans are also standardized. Every US car loan contract carries the same federal Truth in Lending disclosure box (APR, finance charge, amount financed, total of payments), so DecisionTwin can read a contract and quote each value with its page instead of guessing. And the CFPB publishes car-loan examples we can check our math against, to the cent.

The engine underneath is not car-specific. Payment, APR, finance charge, cash flow before and after, savings, stress tests and alternatives work for any fixed-rate installment loan. Only a few inputs are about cars: new-car running costs, replacing your current car, trade-in, and the loan compared with the car's value.

## How we built it
Next.js + TypeScript + Tailwind + shadcn/ui + Recharts → FastAPI + Pydantic v2 → modular Python core: NetworkX dependency graph + YAML ontology (intake), PyMuPDF + deterministic TILA reader + Gemini behind a data-mode gate (documents), a Python `Decimal` engine (formulas F00 to F14), paired scenario simulator, counterfactual grid with Pareto front, and a claim-based explanation builder. SQLite via SQLModel. Gemini only sees synthetic fixtures unless paid-tier terms are confirmed (`LLM_DATA_MODE`).

## Challenges
Getting the loan math right: payment on the note principal but APR on the amount financed, never double-counting prepaid finance charges, and trade-in equity vs. negative equity rolled in. Making "unknown" different from "zero" everywhere.

## Accomplishments
- **Exact to the cent:** the engine reproduces CFPB car-loan reference examples. For example, $20,000 at 4.75% over 60 months gives $375.14 a month and $2,508.29 in interest.
- **Tested end to end:** 362 backend tests, plus live browser checks of the whole flow: manual entry 25/25, contract upload 32/32, accessibility 26/26 with 0 serious issues.
- **Independently audited:** a separate audit agent reviewed every stage against the spec and gave the release a GO.
- **Honest by design:** every number on screen links to its source, and nothing unknown is ever treated as zero.

## What we learned / What's next
- **Any fixed-rate installment loan, next:** personal loans, fixed-rate student loans, furniture and appliance financing, medical payment plans and longer buy-now-pay-later plans. The math engine already handles these. What's left is a loan-type choice at the start, general wording, and hiding the car-only questions. The data model already has a slot for a general installment loan.
- **Loans with different math, later:** mortgages (escrow, PMI, closing costs, adjustable rates), credit cards, and variable-rate or balloon loans, which DecisionTwin refuses today with an explanation.
- **Real contracts:** paid-tier document extraction, scanned documents, and loans with an unusual first payment period.
- **Comparing lenders:** quotes from several lenders side by side.

## Built with
python, fastapi, pydantic, sqlmodel, sqlite, networkx, pymupdf, gemini, nextjs, typescript, tailwindcss, shadcn-ui, recharts
