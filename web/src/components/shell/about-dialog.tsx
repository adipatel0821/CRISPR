"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { plain } from "@/lib/copy";
import { DATA_MODE_TEXT } from "@/components/banners";

/** The standard disclaimer. The report and the end of the summary carry it too. */
export const DISCLAIMER = "These are calculations from your figures, not predictions or financial advice.";

const FIXTURE_TEXT = {
  title: "Example data",
  body: "This build shows bundled example results, not a live analysis of your own figures.",
};

/**
 * "How it works": what the numbers are, the data mode, privacy and the disclaimer, in one place instead of a
 * legal footer on every page. Controlled (open / onOpenChange) so the header and menus can open it.
 */
export function AboutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { health, healthError, fixtures, report } = useApp();
  const mode = fixtures ? FIXTURE_TEXT : health ? (DATA_MODE_TEXT[health.data_mode] ?? DATA_MODE_TEXT.synthetic_only) : null;
  const backendDisclaimers = (report?.disclaimers ?? []).map((d) => plain(d)).filter(Boolean);

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
        <D.Content
          data-about=""
          className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 shadow-surface data-[state=open]:animate-fade-in sm:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <D.Title className="text-title font-bold text-ink">How DecisionTwin works</D.Title>
            <D.Close
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-canvas"
            >
              <X aria-hidden className="size-5" />
            </D.Close>
          </div>
          <D.Description className="mt-2 text-body text-ink-2">
            It shows what a car loan costs and what it leaves you each month and in savings.
          </D.Description>
          <div className="mt-6 space-y-5 text-[15px] leading-relaxed text-ink-2">
            <section aria-labelledby="about-how" className="space-y-1">
              <h3 id="about-how" className="text-base font-bold text-ink">
                Where the numbers come from
              </h3>
              <p>
                Every figure comes from your answers, your loan terms or a calculation on them. Open &ldquo;How we got
                this&rdquo; next to a figure to see its source. If something is unknown, we say so instead of treating it
                as zero.
              </p>
            </section>
            <section aria-labelledby="about-mode" className="space-y-1">
              <h3 id="about-mode" className="text-base font-bold text-ink">
                Data mode
              </h3>
              {mode ? (
                <p>
                  <span className="font-semibold text-ink">{mode.title}.</span> {mode.body}
                </p>
              ) : healthError ? (
                <p>We can&apos;t reach the server right now, so the data mode isn&apos;t known. {healthError.recovery}</p>
              ) : (
                <p>Checking the data mode.</p>
              )}
            </section>
            <section aria-labelledby="about-privacy" className="space-y-1">
              <h3 id="about-privacy" className="text-base font-bold text-ink">
                Your data
              </h3>
              <p>
                Your answers, your loan offer and any document you upload are stored on the server for this session only.
                Delete my data, in the menu, removes them.
              </p>
            </section>
            <section aria-labelledby="about-disclaimer" className="space-y-1">
              <h3 id="about-disclaimer" className="text-base font-bold text-ink">
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
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
