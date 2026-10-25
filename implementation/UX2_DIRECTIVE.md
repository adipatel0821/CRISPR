# DecisionTwin: final UX simplification directive (verbatim brief from the product owner, 2026-10-25)

Binding specification for the UX2 pass. Supervisor notes for the agents are at the end of this file.

---

DECISIONTWIN — FINAL UX SIMPLIFICATION DIRECTIVE
YOUR MISSION
You are a senior product designer, UX engineer, and frontend specialist.

DecisionTwin is functionally working, but its user experience remains unnecessarily complicated.

The problem is information overload. Too many words, too many numbers, too many sections, and too much information displayed simultaneously.

Your task is to radically simplify the existing UI without changing how the product works internally.

The desired experience is:

ChatGPT's simplicity + Linear's polish + a trustworthy financial product.

Calm. Minimal. Intuitive. Human. Beautiful.

The user should understand what to do or what matters within five seconds of opening any screen.

This is a usability and information-hierarchy overhaul, not a new architecture project.

1. ABSOLUTE NON-NEGOTIABLE RULES
DO NOT:

Change the financial engine or formulas F00–F14.

Rewrite backend logic.

Modify API contracts, Pydantic schemas, or database models.

Alter the knowledge graph's question-selection logic.

Change stress-test or alternative calculation algorithms.

Remove existing functionality.

Break document upload, verification, report generation, or session management.

Introduce unrelated features or unnecessary dependencies.

Replace real API responses with mock data.

Remove required warnings, disclaimers, or validation.

Sacrifice accessibility to achieve visual minimalism.

All major changes should remain within web/.

Preserve the existing working version and release-go rollback tag. Implement changes in an isolated UX branch or worktree, then integrate only after verification.

The foundation is already working. Do not rebuild it.

2. THE MOST IMPORTANT DESIGN PRINCIPLE
SHOW LESS. REVEAL MORE ON DEMAND.
The default screen must show only what the user needs at that moment.

Everything else should be accessible through intentional interactions:

Details

Why?

How was this calculated?

View comparison

Show assumptions

View all numbers

Information must remain available, but it must not compete for attention.

Do not solve clutter by merely wrapping the existing wall of content in larger cards.

Actually reduce default text, remove duplication, improve hierarchy, and simplify the interactions.

Strict initial-view content budgets
Intake

One active question.

One primary input or choice group.

One primary action.

At most one short supporting sentence.

Optional explanations collapsed.

Decision Summary

One clear headline.

One primary financial insight.

At most two supporting insights.

One obvious next action.

No dense grids of KPIs.

Stress Tests

One most relevant scenario highlighted.

One short conclusion.

Other scenarios presented as compact selectable rows.

Charts and tables hidden until requested.

Alternatives

Two or three useful comparisons maximum.

One primary figure per option.

One concise trade-off sentence.

Full numerical comparisons hidden initially.

Report

A concise, readable decision summary first.

Supporting analysis and audit details in an optional appendix.

These are initial-view limits, not limits on what the user can eventually access.

3. VISUAL DESIGN SYSTEM
Use a consistently minimalist design language.

Appearance
Neutral white and warm off-white backgrounds.

Charcoal text.

Soft gray secondary text.

One understated accent color.

Generous whitespace.

Restrained corner rounding.

Thin separators only when necessary.

No decorative gradients.

No excessive shadows.

No bright financial dashboard colors.

No unnecessary icons.

No stacked borders and nested cards.

No visual clutter.

Typography
Clear, confident headings.

Comfortable body text.

Excellent spacing and line height.

Short paragraphs.

Very little uppercase text.

No tiny unreadable explanatory text.

Financial figures visually emphasized only when important.

Layout
Prefer a narrow, centered reading column similar to ChatGPT.

Avoid filling the entire desktop screen with cards just because space is available.

Use a consistent maximum content width and generous margins.

Navigation should be quiet and unobtrusive.

Mobile should feel intentionally designed, not like a compressed desktop dashboard.

Motion
Use restrained transitions for:

Advancing questions.

Opening details.

Switching scenarios.

Navigating results.

Respect prefers-reduced-motion.

Do not introduce animations that slow the experience.

4. CONVERSATIONAL INTAKE — HIGHEST PRIORITY
The current intake must feel substantially more natural.

Desired experience
The user sees a focused question, a simple way to answer, and an obvious way forward.

Example:

How much do you take home each month?

[ $4,200 ]

Continue

Below the primary action:

Why do we ask this? · Skip

That's enough.

No visible sidebar full of previous financial facts.

No large readiness panel.

No long descriptions of every analysis.

No unnecessary competing actions.

Interaction requirements
Ask one question at a time.

Make the active question visually dominant.

Auto-focus appropriate inputs.

Allow Enter to continue where safe.

Use clear choice buttons for multiple-choice questions.

Keep validation near the input.

Make transitions feel smooth.

Show a subtle progress indicator.

Allow previous answers to be reviewed or edited.

Place previous answers in a collapsed "Your answers" panel.

Hide optional refinements until the user chooses to improve accuracy.

Preserve skip, decline, estimate, and correction behavior.

"Why we ask" should be a small, accessible disclosure, not a paragraph always displayed.

Important
Do not make the intake look like a simulated chatbot with fake AI messages.

We want the simplicity of ChatGPT's interaction model, not decorative chat bubbles.

The questioning logic must remain exactly as it currently works.

5. LOAN OFFER — SIMPLIFY THE FORM
The existing manual-offer screen still exposes too many fields simultaneously.

Redesign it into a simple guided experience.

Initial view
How would you like to add your loan offer?

Two clean choices:

Upload a contract

Enter details manually

If manually entering:

Show only the minimum fields needed to begin, according to the existing validation contract.

Group secondary fields logically and reveal them when relevant.

Advanced terms such as fees, trade-in information, disclosed APR, and optional add-ons should be available under clearly labeled expandable sections.

Do not automatically hide a required field whose absence prevents successful calculation.

Confirmation
After saving, show a concise summary:

Monthly payment

Loan term

Amount borrowed

Add "Review all terms" for everything else.

Preserve evidence, confirmation, and consistency checks.

6. DECISION SUMMARY — REMOVE THE DATA WALL
The existing results page displays too many insights and financial figures at once.

Replace the default presentation with a clean decision-first experience.

Example
Here's what changes if you take this loan.

Your monthly leftover decreases.

$900 → $525/month

You would also use $4,000 of your $6,000 savings.

[Explore the impact]

Below this, one brief concern and a link to supporting details.

Do not show every financial metric simultaneously.

Default content
One primary insight.

One meaningful supporting concern.

One relevant next action.

Everything else belongs behind a "See financial breakdown" disclosure.

The existing financial calculations, evidence links, assumptions, and warning states must remain accessible.

Important
When information is missing, show a concise and truthful limitation rather than displaying zero as a confirmed number.

Do not invent financial approval, risk scores, or recommendations.

All displayed conclusions must remain grounded in actual backend calculations and claims.

7. STRESS TESTS — ONE SCENARIO AT A TIME
The existing stress-test experience is too information-heavy.

Redesign it around a single selected scenario.

Initial view example
What if your income stopped for two months?

Your savings could run out in month 2.

Largest modeled shortfall: $4,825

Illustrative scenario, not a forecast.

[Explore what happens]

Underneath, show other scenarios as simple selectable rows:

Unexpected expense

Income drops 25%

Vehicle costs rise

Only one scenario should be expanded at a time.

Details on demand
When a user selects a scenario:

Show one useful visualization.

Show a brief with/without-loan comparison.

Allow access to assumptions.

Allow access to the monthly data table.

Do not display every scenario's chart or table by default.

If an input required for a meaningful scenario is unknown, explain that limitation instead of showing a misleading result.

8. ALTERNATIVES — MAKE COMPARISONS INTUITIVE
Do not overwhelm users with a large collection of calculated alternatives.

Initial presentation
What could you change?

Show up to three meaningful choices, if supported:

Keep more savings upfront.

Reduce the monthly payment.

Reduce the total cost of borrowing.

For each:

One important number.

One clear benefit.

One clear trade-off.

Example:

Lower monthly payment

About $320/month

But you'll pay more in total finance charges.

[See details]

Requirements
Use only alternatives actually produced by the existing financial engine.

Preserve constraints and feasibility checks.

Never invent lender-approved rates.

Make assumed rates clear.

Avoid recommending higher down payments without acknowledging savings depletion.

If a comparison cannot be calculated, do not fabricate it.

Put the full scatter chart and numerical comparison table behind "Compare all options."

9. REPORT — HUMAN-READABLE BY DEFAULT
The report must not resemble a backend diagnostics export.

Initial report structure
Your DecisionTwin summary

What you're considering.

What changes financially.

What deserves attention.

Alternatives worth exploring.

What to confirm before signing.

The primary report should be concise enough to read in roughly one or two minutes.

Report design
Prefer one or two pages for the consumer summary.

Avoid lengthy tables in the primary report.

Avoid repeating the same figures in multiple sections.

Remove internal identifiers from consumer-facing prose.

Keep sentences short.

Use whitespace to separate ideas.

Preserve a detailed appendix for calculation evidence, assumptions, and scenario tables.

Ensure print/PDF formatting remains clean with no awkward page breaks or clipped content.

Do not remove any important qualification or supporting data. Relocate it to the appropriate detailed section.

10. CONTENT EDITING IS REQUIRED
This is not just a visual redesign.

Actively edit the user-facing copy.

For every sentence shown by default, ask:

Does the user need to read this to understand or complete the current step?

If not:

Remove it if redundant.

Shorten it.

Or move it into a detail disclosure.

Writing rules
Prefer plain English.

Keep visible explanatory sentences short.

Use direct, conversational language.

Avoid financial jargon unless necessary.

Do not repeatedly explain the same disclaimer.

Avoid internal names such as F03, F14, derived_status, and assumption IDs in primary content.

Preserve required precision and qualifications.

Avoid filler such as "Our intelligent system uses advanced algorithms..."

Replace verbose descriptions with concise, useful explanations.

MANDATORY: REMOVE AI-GENERATED WRITING PATTERNS
The existing application contains too much text that reads like generic AI-generated content.

Perform a thorough editorial cleanup of all user-facing language, including:

Page titles and headings.

Question text.

Helper text and tooltips.

Button labels.

Dashboard insights.

Stress-test descriptions.

Alternative explanations.

Error and validation messages.

Loading and empty states.

Report summaries.

Printable PDF text.

Disclaimers and supporting explanations.

The final product must sound like it was written by an experienced human product writer, not generated by an AI assistant.

Punctuation constraints
Do not use em dashes (—) or en dashes (–) in user-facing copy.

Prefer short sentences, commas, colons, or full stops.

Avoid semicolons unless genuinely necessary.

Remove excessive punctuation and decorative separators.

Do not overuse colons in headings.

Do not use arrows or symbols merely to make ordinary sentences appear more sophisticated.

Do not change mathematical minus signs, numeric ranges, code syntax, or structured financial values when cleaning punctuation.

Avoid common AI writing patterns
Remove unnecessary words and phrases such as:

Delve into

Leverage

Unlock

Empower

Seamlessly

Robust

Cutting-edge

Revolutionary

Transformative

Comprehensive insights

Navigate with confidence

Financial journey

Actionable insights

Tailored to your needs

Data-driven decisions

In today's world

It's important to note

At the end of the day

Let's explore

Here's what you need to know

Not just X, but Y

Whether you're X or Y

This list is illustrative, not exhaustive.

Review the entire application for other repetitive AI-style expressions.

Preferred writing style
Write like a concise, thoughtful financial product.

Be:

Natural.

Specific.

Clear.

Direct.

Calm.

Professional.

Friendly without being overly enthusiastic.

Confident without exaggerating.

Avoid overly formal explanations, robotic phrasing, generic reassurance, and marketing-heavy language.

Use everyday words where possible.

For example:

Instead of:

"Explore powerful, data-driven insights to navigate your financial journey with confidence."

Write:

"See how this loan affects your money."

Instead of:

"Unlock a comprehensive understanding of your financial resilience under various hypothetical scenarios."

Write:

"What happens if your income drops?"

Instead of:

"Leverage our intelligent analysis to discover optimized financial alternatives."

Write:

"See what you could change."

Instead of:

"Your financial situation may be significantly impacted by this proposed commitment."

Write:

"This loan leaves you with less money each month."

No repetitive AI-generated explanations
Do not repeat the same conclusion across multiple cards.

Do not include several paragraphs explaining one obvious number.

Do not use generic introductions before every section.

Do not repeatedly remind users that DecisionTwin is intelligent or AI-powered.

Do not insert unnecessary inspirational statements.

Do not add filler to make the report appear more substantial.

If a sentence does not help the user understand a number, complete an action, identify a limitation, or make an informed comparison, remove it.

Financial accuracy must remain intact
Simplifying language must never change the meaning of the calculations.

Keep necessary terms such as APR, finance charge, principal, and amount financed when they are legally or technically important. Explain them briefly if needed.

Preserve required disclaimers, uncertainty labels, evidence, assumptions, and limitations.

Avoid replacing precise financial claims with vague or overly confident statements.

Do not alter backend-generated financial claims or calculation contracts merely to remove stylistic patterns. Where necessary, present existing claims through concise frontend wording derived from their structured values while preserving their original meaning and accessible evidence.

Editorial quality gate
Before completion, review every primary screen and the generated PDF as a human editor.

Confirm:

No unnecessary em dashes or en dashes remain in user-facing copy.

No generic AI marketing phrases remain.

No repeated or robotic explanations dominate the page.

Every sentence sounds natural when read aloud.

All financial statements retain their correct meaning.

The copy is short enough to scan quickly.

Legal, financial, and privacy disclosures remain accurate.

A visually clean interface with AI-generated walls of text is not an acceptable outcome.

11. USABILITY ACCEPTANCE TESTS
Do not declare this redesign complete just because it looks cleaner in a screenshot.

Verify the actual user experience.

Test A — Five-second clarity
For every screen, confirm a first-time user can immediately identify:

Where am I?

What matters here?

What should I do next?

Test B — Visual density
At a standard desktop viewport and a mobile viewport:

Only essential information appears initially.

The page does not resemble a spreadsheet.

No wall of text appears above the primary action.

No unnecessary numerical grid competes with the main insight.

Secondary details are genuinely collapsed.

The user can find all deeper information when needed.

Test C — Functional preservation
Verify:

Adaptive questions still work.

All valid answers can be entered.

Saved facts can still be edited.

Manual offers work.

Document upload and verification work.

Financial results are unchanged for identical inputs.

Stress-test results remain unchanged.

Alternative calculations remain unchanged.

Reports still print.

Source evidence remains accessible.

Session deletion works.

Keyboard navigation and screen readers remain supported.

Test D — Evidence and honesty
No meaningful financial claim may lose its evidence.

A concise interface must not become a misleading interface.

Warnings and important missing information must remain visible when they materially affect the user's understanding, even if other technical details are collapsed.

Test E — Human-written content
Verify that the default screens, help text, analysis summaries, and printed report satisfy all the editorial requirements in Section 10.

Check both visible default content and expandable details. Review representative error states and reports as well.

Do not pass this check based on a keyword scan alone. A human-style editorial review is also required.

12. IMPLEMENTATION WORKFLOW
Inspect the latest implementation and current working tree.

Capture baseline screenshots of each existing screen.

Identify visible text, cards, and numbers that create unnecessary cognitive load.

Redesign the intake and decision summary first.

Apply the same simplified design system to offers, stress tests, alternatives, and reports.

Reuse existing components where possible.

Do not touch backend code or authoritative financial logic.

Run TypeScript checks, linting, build, relevant frontend tests, browser flows, and regression tests.

Compare outputs against the existing financial reference fixtures.

Have Agent 5 independently audit functionality, accessibility, information availability, and editorial quality.

Capture before-and-after screenshots at desktop and mobile sizes.

Commit and push only after integration tests and audit approval.

Required final delivery
Provide:

Screens changed.

What was removed from the initial view.

What moved behind disclosures.

Before-and-after screenshots.

Summary of rewritten user-facing copy.

Exact tests executed and results.

Evidence that financial calculations were untouched.

Audit verdict.

Commit SHA.

Remaining limitations.

Do not use passing regression tests as the sole proof of good UX. The visual-density, five-second-clarity, and human-writing checks are mandatory.

FINAL DESIGN STANDARD
DecisionTwin should feel effortless.

Users should not have to understand finance terminology, inspect ten cards, or read paragraphs of explanation to understand one result.

One question. One clear answer. One obvious next action.

Everything else should be available when requested.

The objective is not to make a complicated application look simpler.

The objective is to make the experience genuinely simpler while preserving its intelligence, mathematical accuracy, and transparency.

Implement this as a focused frontend simplification pass. Do not rebuild the foundation.

---

## Supervisor notes (binding for UX2 agents)

- **Baseline (before):** `audit/evidence/ux2/before/` holds first-screen and full-page screenshots of 13 screen states at 1280 px and 390 px, plus `metrics.json`, produced by `web/e2e/screens.mjs` with `web/e2e/lib/density.mjs` against the build at `0f0b6e9`. Baseline highlights: decision summary 435 visible words and 22 dollar figures; report 650 words on screen, 3,505 words and 443 dollar figures in print; em/en dashes on most results screens (report 30). The keyword scan finds no banned phrases, so the AI-style writing problem needs human editing, not just a scan.
- **Known content defects to fix:**
  - Stress test "Vehicle cost change 20% higher" reports "Savings last all 12 months" while new-car running costs are unknown (F14 is an assumed $0, assumption `a_no_running_costs`). That result is meaningless; show the limitation instead (section 7, last line).
  - Most dashes on results screens come from backend-generated text (claim sentences, scenario names such as "months 2–3", assumption texts, evidence labels). The backend must not change. Present those through frontend wording built from structured values (claim.values, metrics, scenario_id, flags, assumption ids), with a display normalizer as the fallback for any backend text still shown.
  - Backend question texts (intake ontology) and choice labels are long; present concise frontend wording keyed by fact_key and enum value, keep the backend why_we_ask behind "Why do we ask this?".
- **No arithmetic in TypeScript.** Every money value shown comes from a backend field. Comparing, sorting, selecting, counting and formatting are allowed. Do not compute "you would use $4,000 of your $6,000 savings" by subtraction; use backend values (for example savings before and savings after purchase, both backend values).
- **Evidence:** every meaningful financial claim keeps a reachable source (one click). Prefer native `<details>` (content stays in the DOM) so information-availability metrics stay meaningful.
- **Every screen has exactly one primary action** rendered through the shared `PrimaryAction` with a `data-primary-action` attribute (the density script counts it).
