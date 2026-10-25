"use client";

import { useApp } from "@/lib/app-context";
import { plain } from "@/lib/copy";
import { InfoDialog } from "@/components/ui/misc";
import { DATA_MODE_TEXT, FIXTURE_TEXT } from "@/components/banners";

/** The standard disclaimer. The report and the end of the summary carry it too. */
export const DISCLAIMER = "These are calculations from your figures, not predictions or financial advice.";

/**
 * "About this analysis": what the numbers are, the data mode, privacy and the disclaimer, in one place instead
 * of a legal footer on every page.
 */
export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { health, healthError, fixtures, report } = useApp();
  const mode = fixtures ? FIXTURE_TEXT : health ? (DATA_MODE_TEXT[health.data_mode] ?? DATA_MODE_TEXT.synthetic_only) : null;
  const backendDisclaimers = (report?.disclaimers ?? []).map((d) => plain(d)).filter(Boolean);

  return (
    <InfoDialog
      open={open}
      onOpenChange={onOpenChange}
      title="About this analysis"
      description="DecisionTwin shows what a car loan costs and what it leaves you each month."
    >
      <div className="space-y-5" data-about="">
        <section aria-labelledby="about-how" className="space-y-1">
          <h3 id="about-how" className="text-[15px] font-medium text-ink">
            How it works
          </h3>
          <p>
            Every figure comes from your answers, your loan terms or a calculation on them. Open &ldquo;How we got
            this&rdquo; next to a figure to see its source. Where something is unknown, we say so instead of
            treating it as zero.
          </p>
        </section>

        <section aria-labelledby="about-mode" className="space-y-1">
          <h3 id="about-mode" className="text-[15px] font-medium text-ink">
            Data mode
          </h3>
          {mode ? (
            <p>
              <span className="text-ink">{mode.title}.</span> {mode.body}
            </p>
          ) : healthError ? (
            <p>We can&apos;t reach the server right now, so the data mode isn&apos;t known. {healthError.recovery}</p>
          ) : (
            <p>Checking the data mode.</p>
          )}
        </section>

        <section aria-labelledby="about-privacy" className="space-y-1">
          <h3 id="about-privacy" className="text-[15px] font-medium text-ink">
            Your data
          </h3>
          <p>
            Your answers, your loan offer and any document you upload are stored on the server for this session only.
            Delete my data, in the More menu, removes them.
          </p>
        </section>

        <section aria-labelledby="about-disclaimer" className="space-y-1">
          <h3 id="about-disclaimer" className="text-[15px] font-medium text-ink">
            What this is not
          </h3>
          <p data-disclaimer="">{DISCLAIMER} Check every figure with your lender before you sign.</p>
          {backendDisclaimers
            .filter((d) => d !== DISCLAIMER)
            .map((d) => (
              <p key={d}>{d}</p>
            ))}
        </section>
      </div>
    </InfoDialog>
  );
}
