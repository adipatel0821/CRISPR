# UX3 e2e port map (integration, feature/ux3-integration)

Every screen was redesigned in UX3 (welcome, intake, offer, summary, stress test, options, report), so the four
screen-specific UX1/UX2 browser scripts were retired and their assertions now live in the `s3_*` scripts or in the
ported cross-cutting scripts. No expected value was changed or dropped. Where a figure moved into a disclosure, the new
script opens the disclosure (or reads `textContent`, which includes closed `<details>`) before asserting it, and the
`s3_*` scripts additionally assert the headline figures as VISIBLE.

Kept and ported to the UX3 UI (same expected values):

| Script | What changed in the script | Expected values (unchanged) |
|---|---|---|
| `web/e2e/manual_flow.mjs` | `WEB` from env; the question is read from `form[data-fact-key]` (h1 on /intake) and answered by fact key; amounts typed into `[data-amount-input] input`; down payment chosen with the `[data-option-tile]` "savings" tile; the pending down-payment question is answered inline on /offer ("Before your results") with the old /intake fallback kept; dashboard readiness waits for `[data-summary-hero]`. | 375.14, 22,508.29, 3,008.29, 26,508.29, 1,300, 924.86, 2,000, savings 6,000.00, discretionary / running-costs labels, no fixture banner, no "verified", ≥2 assumption chips, none on loan-cost figures, /stress illustrative, /alternatives same rate, no sideways scroll at 360 px, no console errors |
| `web/e2e/doc_flow.mjs` | same intake helper; upload chosen with the "Upload the contract" radio tile; quote suffix is now ", page 1" (copy rule: no dashes); manual fallback button is "Enter the numbers instead"; pending question answered inline. | A: $375.14, $22,508.29, $3,008.29, $19,500.00, $20,000.00 in the review; exact quote + page 1; "From your document, p.1"; dashboard 375.14 / 22,508.29 / 3,008.29; document evidence in the report; Monthly payment source popover lists the document quote. B: 60-month option ($375.14, not 319.78), "OPTION A - 60 MONTHS". C: variable rate unsupported, one alert, reference-only heading, no save path, manual form opens |
| `web/e2e/a11y.mjs` | intake by fact key (Tab reaches the amount field, Enter/Space on Continue); offer method is now a native radio group (arrow key selects "Upload the contract"); after "Save checked offer" it waits for the saved offer or the inline pending question (See my results only appears once the down payment is answered); dashboard readiness `[data-summary-hero]`; the file-chooser listener is registered before the Enter press (the old `Promise.all` raced it). | axe 0 serious/critical on every page and state; keyboard-only journey reaches the dashboard with 375.14 and 2,000.00; Monthly payment source opens with Enter |
| `web/e2e/s3_foundation.mjs`, `web/e2e/s3_summary_stress.mjs` | palette assertions follow the owner's 2026-10-25 change: frame band is black `rgb(17, 17, 17)`, primary pill is the blue accent `rgb(42, 100, 227)` (they still asserted the superseded blue band / yellow pill). | unchanged |

Retired (all assertions covered elsewhere):

| Old script | Old assertion | Now covered by |
|---|---|---|
| `ux_a_flow.mjs` | manual: 4 household questions asked, answers with status, edit saved, down payment asked | `s3_intake.mjs` (questions, rail answers with Edit, "Saved/Updated" status, edit pane), `manual_flow.mjs` |
| | intake done with offer: primary is See my results; running-costs not-included note | `s3_intake.mjs` (done state primary actions, `[data-month-as-told]`, running costs) |
| | pending: "Please confirm the values match your offer"; open question inline; See my results waits | `s3_offer_options.mjs` (confirmation required, `pendingChecks()`) |
| | dashboard 375.14 / 22,508.29 / 3,008.29 / 26,508.29, savings 6,000 → 2,000 | `s3_summary_stress.mjs`, `manual_flow.mjs` |
| | A: verification $375.14 / $22,508.29 / $3,008.29 / $19,500.00 / $20,000.00, quote with page, "From your document, p.1", never "verified" | `s3_offer_options.mjs`, `doc_flow.mjs` |
| | B: chosen option values; C: unsupported message, one alert, no save path, manual fallback | `s3_offer_options.mjs`, `doc_flow.mjs` |
| | axe 0 serious/critical, no sideways scroll, no console errors | every `s3_*` script, `a11y.mjs` |
| `ux_b_flow.mjs` | dashboard values (hidden and VISIBLE): 375.14, 22,508.29, 3,008.29, 26,508.29, 2,000.00, 1,300.00, 924.86, 6,000.00 | `s3_summary_stress.mjs` ("summary shows" + "summary VISIBLE") |
| | running-costs limitation visible, discretionary label visible, no approval / verified language | `s3_summary_stress.mjs` |
| | "three insight headings" | replaced by the UX3 hero structure; `s3_summary_stress.mjs` asserts the hero, the before/after bars on one zero scale, the savings line and the two secondary columns |
| | one primary action to /stress; disclosure opens with keyboard; no sideways scroll at 360 | `s3_summary_stress.mjs` (primary to /stress, full breakdown opened with Enter, 390/360 px) |
| | stress: Illustrative, one primary action to /alternatives | `s3_summary_stress.mjs` ("Illustrative scenario, not a prediction", `[data-primary-action]` to /alternatives) |
| `ux_c_flow.mjs` | alternatives: framing line, h1, 1 to 3 highlighted cards, same-rate badge, rate sensitivity, banned words, Compare all N options (keyboard), primary to /report | `s3_offer_options.mjs` (options part) |
| | report: 375.14, 22,508.29, 3,008.29, 26,508.29, 6,000.00, 2,000.00; running costs disclosed; banned words; sections; appendix collapsed; print shows appendix, hides toolbar and header; appendix keyboard; amortization + ids; delete asks for confirmation | `s3_report.mjs` (values on screen and in the PDF text, sections, appendix toggle and print include/exclude, print hides rail/toolbar/header, keyboard, delete alertdialog) |
| `ux_c_print.mjs` | print height and PDF page count | `s3_report.mjs` (PDF summary 1 to 2 Letter pages, appendix only when chosen, PDF text checks) |

Run results for this integration (live API on :8305, web on :3305, fresh DB) are in the status packet of the
integration agent and in `audit/evidence/ux3/COMPARISON.md`.
