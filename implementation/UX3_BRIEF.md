# DecisionTwin Final UI/UX Redesign
## Peddle-Inspired Visual Storytelling and Premium Product Experience

(Owner's brief, verbatim, 2026-10-25 09:35 ET. Supervisor design plan: implementation/UX3_DESIGN_PLAN.md.)

You are acting as a principal product designer, senior frontend engineer, and UX specialist.

Your task is to deliver the final visual redesign of DecisionTwin.

The product's existing financial calculations, backend, API contracts, and core workflows are functional. Do not rebuild them.

The current website feels too flat, rigid, narrow, text-heavy, and repetitive. It does not use desktop screen space effectively. Its many similar cards, long paragraphs, and small financial figures make it difficult to know where to look.

We need a substantially more polished, visually engaging, intuitive product experience.

This must be a real implementation, not a Figma proposal, mockup, or superficial CSS refresh.

## 1. Study the reference before making changes

### Primary visual reference

**Peddle:** https://www.peddle.com/

I am providing two Peddle screenshots:

**Screenshot 1: Guided input screen**
- Bright blue full-width header.
- Large white application surface.
- Compact left sidebar showing progress and context.
- Large right workspace containing one question.
- Clear, attractive input controls.
- Excellent use of whitespace.
- Useful contextual help.
- Bottom navigation without unnecessary distractions.

**Screenshot 2: Final offer screen**
- Extremely large blue financial result.
- Clear visual hierarchy.
- Prominent yellow Next button.
- Personalized context in the left sidebar.
- More useful explanations below the main result.
- Strong use of typography, contrast, and alignment.
- Content fills the available landscape space.
- The result feels like an important moment.

### Research assignment

Study Peddle's real website, product flow, and public design references.

Examine:
- Its onboarding experience.
- Page composition.
- Desktop and mobile layouts.
- Persistent context and progress indicators.
- Question sequencing.
- Typography hierarchy.
- Accent colors.
- Use of illustrations and icons.
- Placement of controls.
- Visual transitions.
- How major results are presented.
- How secondary information is organized.
- How the user's attention is directed.

Identify the underlying UX principles and adapt them to DecisionTwin.

**Do not clone Peddle's logo, copyrighted graphics, wording, product identity, or exact screen design.**

Use it as inspiration for layout, hierarchy, interaction quality, and emotional engagement.

DecisionTwin must retain its own recognizable brand and purpose.

---

## 2. Core objective: Make the interface visually engaging

Our current website relies too heavily on text and rectangular cards.

That must change.

The redesigned experience should combine:

- Large, expressive typography.
- Meaningful iconography.
- Carefully selected illustrations.
- Visual financial comparisons.
- Strong contrast between important and secondary information.
- Different section layouts.
- Interactive elements.
- Purposeful color.
- Smooth transitions.
- Clear and predictable navigation.
- Progressive disclosure.

**Make the experience interesting to look at without making it distracting.**

This is a financial decision-support product. It should feel trustworthy, professional, and approachable.

Avoid making it look like:
- A banking administration dashboard.
- An insurance quotation portal.
- A generic AI-generated SaaS template.
- A collection of identical information cards.
- A spreadsheet translated into a webpage.
- A chatbot with fake message bubbles.

---

## 3. Use the full desktop viewport

This is a critical requirement.

The existing application uses narrow reading-width constraints on screens that should take advantage of landscape orientation.

Inspect the layout system, including the existing `--width-reading`, `--width-results`, Container components, and route-level max-width classes.

Replace unnecessarily narrow desktop layouts with responsive, wide compositions.

### Desktop layout requirements

For desktop widths around 1440 to 1920 pixels:

- Use approximately 90% to 96% of the available viewport width where appropriate.
- Allow a maximum application width around 1600 to 1800 pixels if necessary.
- Introduce flexible two-column and asymmetric layouts.
- Let major result sections occupy the visual space they deserve.
- Use space to show relevant visuals or contextual information, not to add filler.
- Avoid enormous unused margins on both sides of every screen.

### Preferred composition

For guided steps, use something resembling:

**Left section, approximately 22% to 28%**
- DecisionTwin branding.
- Progress.
- Current stage.
- Relevant answers.
- Navigation to previously completed steps.

**Main section, approximately 72% to 78%**
- Current question or outcome.
- Primary interaction.
- Contextual illustration or financial visualization where helpful.
- One obvious next action.

The left section should adapt to the stage. It should not display irrelevant information or become a second wall of text.

### Important distinction

Use the full screen without stretching paragraphs across the entire viewport.

Keep individual text blocks comfortably readable while allowing the overall composition to be wide.

Use negative space deliberately.

### Mobile

At mobile widths:
- Collapse the left sidebar into accessible progress and answer controls.
- Stack sections in the correct reading order.
- Keep financial figures readable.
- Preserve one primary action.
- Avoid horizontal overflow.
- Do not rely on hover-only interactions.

---

## 4. Establish a distinctive visual identity

Create or refine a cohesive DecisionTwin design system.

### Suggested palette

Use the Peddle screenshots as inspiration:

- Confident blue: approximately `#2874E6`.
- Warm yellow: approximately `#FFDA68`, reserved for important calls to action.
- Soft off-white canvas: `#F5F7FB`.
- Clean white surfaces: `#FFFFFF`.
- Deep charcoal or navy text: `#202B3B`.

These are starting points, not mandatory final values.

Refine the palette for an original DecisionTwin identity.

Use semantic colors carefully for financial concerns and limitations.

Never communicate financial outcomes using color alone.

### Typography

Create a deliberate type scale:

- Strong display headlines.
- Large financial figures.
- Readable section headings.
- Comfortable body text.
- Quiet metadata.

Use a modern, highly legible font family with a restrained display treatment if it genuinely improves the hierarchy.

Do not introduce multiple unrelated font families.

Example desktop sizes:
- Hero headings: 44 to 64 px.
- Primary financial figures: 64 to 100 px when appropriate.
- Section headings: 24 to 32 px.
- Body text: 16 to 18 px.
- Supporting labels: 14 px or larger where practical.

Use responsive scaling rather than fixed oversized typography.

### UI components

Build visual variety through a small, consistent system of:
- Editorial hero sections.
- Split-screen layouts.
- Segmented controls.
- Selectable option tiles.
- Compact contextual panels.
- Horizontal financial comparisons.
- Purposeful diagrams.
- Expandable explanations.
- Clear primary actions.
- Minimal separators.

Avoid wrapping every sentence in a bordered card.

---

## 5. Add meaningful visual elements

The current website needs more than text.

Introduce original, relevant visual elements that help users understand their financial situation.

### Iconography

Use consistent, professional icons such as those available through Lucide.

Examples:
- Wallet: monthly cash flow.
- Piggy bank: savings.
- Calendar: loan term.
- Car: vehicle financing.
- Receipt: charges and fees.
- Shield: financial resilience.
- Alert symbol: potential shortfall.
- Sliders: adjusting alternatives.

Use icons to convey meaning, not simply decorate headings.

### Illustrations

Use simple, original SVG or vector illustrations where appropriate.

Potential themes:
- Car financing.
- Household budgeting.
- Money moving between spending and savings.
- Financial uncertainty.
- Comparing two choices.

Avoid generic AI-generated stock visuals, excessive 3D illustrations, random robot imagery, or irrelevant decorative pictures.

Do not use Peddle's proprietary graphics.

### Financial visualizations

Turn selected financial relationships into intuitive graphics.

Examples:
- Before and after monthly surplus.
- Savings before and after the down payment.
- Total amount borrowed versus financing cost.
- Savings trajectory during an income shock.
- Two loan alternatives compared visually.

Prefer simple, accurate visualizations over complex dashboard charts.

Use backend-derived values only.

Never exaggerate differences through misleading chart scales.

---

## 6. Tell a visual story across the user journey

The interface should guide users through a coherent financial decision.

**Understand the person → Understand the offer → Reveal the impact → Explore vulnerability → Compare choices → Review the decision.**

Each step should look and feel distinct, while retaining one consistent design language.

The user's attention should naturally move toward the most relevant information and next action.

Do not make every screen look like the same template with different text.

### Screen A: Welcome

Create a visually compelling landing experience.

It should immediately answer:
- What is DecisionTwin?
- What can it help me understand?
- How do I begin?

Use a strong headline, one clear supporting sentence, and one prominent start button.

Include a tasteful visual explaining the concept of comparing a loan against personal finances.

Privacy and product limitations must remain accessible.

Do not invent lender partnerships, ratings, endorsements, or other trust signals.

### Screen B: Financial Intake

Follow the general interaction structure shown in Peddle Screenshot 1.

Use a wide workspace with a compact progress sidebar.

Show one question at a time.

Example:

**How much do you bring home each month?**

Large, comfortable currency input.

A small line of useful guidance.

One prominent Continue button.

A contextual help link.

Make selection inputs feel responsive and easy to operate.

For appropriate question types, use selectable option tiles, segmented controls, or well-designed dropdowns.

Place explanations behind compact disclosures.

Allow users to review and edit previous answers through the sidebar.

Keep the existing adaptive question logic unchanged.

### Screen C: Loan Offer

Create a guided, visually intuitive entry experience.

Let the user choose between:
- Uploading a document.
- Entering loan details manually.

Use meaningful document and keyboard icons.

Avoid displaying every advanced financial field simultaneously.

Group related fields into understandable steps without hiding inputs required for valid calculations.

Provide a clean confirmation state with the key terms.

Keep source evidence and validation accessible.

### Screen D: Decision Summary

This is the most important screen.

Use Peddle Screenshot 2 as inspiration for the presentation of a major result.

Instead of a small heading followed by many cards, build a **large financial outcome hero**.

For example, using the existing reference test case:

**Here's how this loan changes your month.**

A large figure:

**$525 left each month**

Supporting comparison:

Before the loan: $900.

After the loan: $525.

Then show one concise supporting concern:

"Your savings would drop to $2,000 after the down payment."

Use a compelling, accurate before-and-after visualization alongside the hero.

A strong primary action should lead to stress testing or the next relevant stage.

This is illustrative copy. Use the actual calculated result and disclose missing ownership costs when relevant.

#### Make important findings feel important

The most consequential result must be immediately visible.

Secondary metrics should be progressively disclosed.

Avoid showing six to ten equally weighted figures.

The design should make it obvious where the user should look first, second, and third.

Do not invent a financial approval verdict or imply the system can guarantee affordability.

### Screen E: Stress Tests

Replace long repetitive scenario pages with a visually guided experience.

Start with the most consequential available scenario, using existing calculation results.

Example:

**What if you lost your income for two months?**

Large emphasized finding:

**Savings run out in month 2**

Supporting detail:

**$4,825 modeled shortfall**

Clearly state that this is an illustrative scenario, not a prediction.

Use one prominent chart showing the savings trajectory.

Present other scenarios through selectable options or compact tabs.

Switching scenarios should update the displayed outcome and chart.

Keep detailed assumptions and monthly tables accessible but collapsed.

If a scenario has missing inputs, communicate the limitation rather than inventing a result.

### Screen F: Alternatives

Create a visual comparison experience rather than a numerical catalogue.

Present at most three meaningful options initially.

Use varied layouts, but keep the comparisons consistent and understandable.

For example:
- Reduce the monthly payment.
- Reduce the borrowing cost.
- Preserve more savings, if an existing calculated alternative supports this.

Show the main number prominently.

Make the trade-off easy to understand.

Use a compact visual comparison against the current loan.

Allow users to expand the full table and chart.

Only display actual engine-generated alternatives.

Do not fabricate new loan terms, interest rates, approved offers, or financial recommendations.

### Screen G: Final Report

Make the report feel like the conclusion of the entire experience.

Use clear editorial design.

The initial presentation should summarize:
- The loan being evaluated.
- What changes financially.
- The principal concern.
- Relevant comparisons.
- What the user should confirm next.

Use bold, readable numbers and small supporting visuals.

Avoid paragraphs filled with repeated AI-style explanations.

Keep technical calculations, provenance, and detailed assumptions in a clearly structured appendix.

Ensure the printed PDF is professional and readable.

---

## 7. Replace rigid layouts with visual rhythm

Do not create seven screens filled with identical cards.

Use appropriate variations:
- Large hero beside a simple graphic.
- A horizontal financial comparison.
- A concise contextual sidebar.
- A visual timeline.
- A wide highlighted finding.
- Small selectable scenario tiles.
- A comparison with two contrasting columns.
- A clear full-width next-step section.

Use spacing and typography to separate ideas.

The composition should feel designed, not programmatically generated.

### Visual hierarchy requirement

Every page must have:

1. A clear entry point for the eye.
2. A primary message or task.
3. Supporting visual context.
4. One obvious next action.
5. Optional deeper information.

If users have to scan an entire page to find the important result, redesign the page.

---

## 8. Human-written content only

The previous interface contains unnecessary AI-generated writing patterns.

Perform an editorial cleanup alongside the visual redesign.

Requirements:
- Remove unnecessary em dashes and en dashes in user-facing prose.
- Avoid generic AI phrases.
- Avoid repetitive introductory paragraphs.
- Avoid inflated marketing language.
- Avoid redundant explanations.
- Use short, natural sentences.
- Make button text specific and useful.
- Preserve accurate financial terminology.
- Preserve required warnings and disclosures.

The writing should feel like a professional product team wrote it.

Not like an AI-generated report.

Do not edit backend financial calculations simply to satisfy copy preferences.

---

## 9. Protect the working foundation

### Repository

https://github.com/adipatel0821/CRISPR.git

Primary implementation branch:
`decisiontwin-implementation`

An earlier UX2 experiment may exist on:
`feature/ux2-foundation`

Inspect the latest branches and working tree first.

Reuse previous UX work only if it passes review and genuinely supports this new direction.

The implementation branch contains the audited submission release.

### Absolute restrictions

Do not:
- Modify backend financial formulas F00–F14.
- Change Pydantic schemas.
- Change database structure.
- Change API contracts.
- Replace actual financial data with placeholders.
- Remove provenance.
- Remove meaningful warnings.
- Alter stress-test mathematics.
- Alter alternative calculations.
- Break the adaptive question flow.
- Break document extraction or confirmation.
- Break report generation or deletion.
- Delete or move the existing rollback tags.

Keep the redesign isolated on a new feature branch until fully verified.

Only change the foundation where a frontend styling or component adaptation is required.

Do not rewrite the architecture.

---

## 10. Implement using an efficient design workflow

First inspect the project.

Then produce a brief design plan describing:
- The new visual identity.
- The intended layouts.
- Reusable components.
- Screens being updated.
- Which parts of the current application will remain untouched.

Do not spend excessive time producing documentation before implementation.

Build the actual frontend.

Use existing dependencies where possible.

Inspect the repository's existing icons, charting, animations, typography, and UI component libraries before adding anything.

Any introduced asset must be original, properly licensed, or generated specifically for this product.

Do not use copyrighted Peddle graphics.

### Required implementation priorities

1. Global layout, spacing, typography, and color system.
2. Two-panel conversational intake.
3. Visually compelling Decision Summary.
4. Interactive Stress Tests.
5. Improved Alternatives.
6. Loan Offer screen.
7. Report and print styling.
8. Responsive polish and accessibility.

If a deadline prevents the entire redesign from being safely completed, prioritize the first three items and preserve the audited release.

Never merge or push unverified code into the submission branch.

---

## 11. Mandatory browser-based review

A successful build does not prove that the interface looks good.

You must launch the real application and inspect it in the browser.

Use the real app, not static mockups.

Test at:
- 1440 × 900.
- 1920 × 1080.
- 768 px tablet width.
- 390 px mobile width.

### Visual acceptance criteria

**Desktop**
- The website uses landscape space effectively.
- Main content is not trapped inside an unnecessarily narrow column.
- There are no huge unexplained empty margins.
- Important figures stand out.
- Text remains readable.
- Contextual panels add value.
- There is visual variety across screens.
- The primary action is easy to find.
- The layout resembles a professionally art-directed consumer product.

**Mobile**
- Content reflows naturally.
- The visual hierarchy remains clear.
- Inputs are comfortable to use.
- Financial values do not overflow.
- Navigation remains accessible.
- No horizontal scrolling is required.

**Interaction**
- Questions advance smoothly.
- Progress persists correctly.
- Buttons and disclosures work.
- Charts remain accurate.
- Tooltips and help remain accessible.
- Keyboard navigation works.
- Reduced-motion settings are respected.

### Screenshot review

Capture before-and-after screenshots.

Compare them against the supplied Peddle screenshots for:
- Hierarchy.
- Layout usage.
- Typography.
- Color.
- Interaction clarity.
- Emotional quality.
- Amount of unnecessary text.
- Balance between information and visuals.

Judge the design critically.

If it still looks like a flat insurance quotation portal or generic dashboard, the redesign is incomplete.

---

## 12. Regression and independent audit

After implementing:

Run:
- Frontend typecheck.
- ESLint.
- Production build.
- Relevant frontend unit tests.
- Backend regression suite.
- Existing manual-entry browser flow.
- Existing document-upload browser flow.
- Stress and alternatives verification.
- Report print/PDF checks.
- Accessibility checks.

Use the existing financial reference cases to prove the numbers have not changed.

Have the Independent Audit Agent verify:
- Financial calculations remain unchanged.
- API behavior remains intact.
- The complete flow still works.
- No essential financial data is hidden irretrievably.
- Source attribution still works.
- The visual redesign meets the brief.
- No new accessibility problems were introduced.

Do not claim tests passed unless they actually ran.

### Required final output

Provide:
1. Summary of visual changes.
2. Screens and components modified.
3. Before-and-after screenshots.
4. Desktop and mobile verification.
5. Tests executed and their results.
6. Independent audit verdict.
7. Commit and branch details.
8. Any remaining limitations.

Do not merge into the audited release until integration testing and audit approval.

---

## FINAL QUALITY STANDARD

DecisionTwin must look and feel like a polished, production-quality consumer financial application.

A user should immediately understand:
- Where they are.
- What they need to do.
- What the most important financial result is.
- Why it matters.
- What they can explore next.

It should feel visually confident, intuitive, engaging, and thoughtfully designed.

Use large meaningful financial results, icons, original illustrations, color, typography, layout variation, and progressive disclosure to guide attention.

**Do not merely repaint the current interface. Transform the visual experience while preserving everything that already works.**

Start by studying the attached Peddle screenshots and the existing DecisionTwin repository. Then implement the redesigned experience directly in the application.
