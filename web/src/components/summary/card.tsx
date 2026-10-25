"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { CardDetails } from "./details";
import { CardTop } from "./hero";

const DETAILS_ID = "card-details";
/** Hashes that open the details: the region itself, the old breakdown anchor, and sections inside it. */
const OPEN_ON = new Set(["details", "breakdown", DETAILS_ID, "assumptions", "loan-cost", "look-next", "savings", "flags", "unknowns", "sources"]);
/** Matches the height transition below, so a scroll target is measured after the card has opened. */
const OPEN_MS = 260;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The decision summary as ONE result card. The result sits at the top and is always visible; everything else
 * (cost, the main concern, options, savings, flags, assumptions, unknowns, every source) is behind one button
 * that expands the same card in place. The details stay in the DOM while closed (inert and hidden), print
 * expanded, and open by themselves when the page is reached at #details, #breakdown or one of their sections.
 */
export function ResultCard({ report }: { report: DecisionReport }) {
  const [open, setOpen] = React.useState(false);
  /** Section to bring into view once the card has opened (from the URL hash). */
  const [target, setTarget] = React.useState<string | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const sync = () => {
      let h = "";
      try {
        h = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!OPEN_ON.has(h)) return;
      setOpen(true);
      setTarget(h === "details" || h === "breakdown" ? DETAILS_ID : h);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Runs after the open state is committed; waits for the height transition so the page is tall enough to scroll.
  React.useEffect(() => {
    if (!open || !target) return;
    const timer = window.setTimeout(() => {
      document.getElementById(target)?.scrollIntoView({ block: "start" });
      setTarget(null);
    }, reducedMotion() ? 0 : OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open, target]);

  const hide = React.useCallback(() => {
    setOpen(false);
    const t = toggleRef.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  return (
    <section
      data-result-card=""
      aria-labelledby="summary-title"
      className="min-w-0 overflow-clip rounded-[1.75rem] border border-line bg-surface shadow-soft print:overflow-visible print:rounded-none print:border-0"
    >
      <CardTop report={report} />

      <div className="no-print border-t border-line">
        <button
          ref={toggleRef}
          type="button"
          id="card-toggle"
          data-card-toggle=""
          aria-expanded={open}
          aria-controls={DETAILS_ID}
          aria-describedby="card-toggle-hint"
          onClick={() => setOpen((o) => !o)}
          className="group/toggle flex min-h-20 w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-subtle focus-visible:outline-offset-[-4px] sm:px-8 xl:px-10"
        >
          <span className="min-w-0">
            <span className="block text-[18px] font-extrabold leading-snug text-ink">{open ? "Hide details" : "Show all details"}</span>
            <span id="card-toggle-hint" aria-hidden className="mt-0.5 block text-pretty text-[15px] leading-snug text-ink-2">
              What the loan costs, what to look at next, your savings, flags, assumptions and every source.
            </span>
          </span>
          <span
            aria-hidden
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-ink transition-colors duration-150 group-hover/toggle:border-ink-3"
          >
            <ChevronDown className={cn("size-5 transition-transform duration-200 ease-calm", open && "rotate-180")} />
          </span>
        </button>
      </div>

      <div
        id={DETAILS_ID}
        data-card-details=""
        data-state={open ? "open" : "closed"}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows,visibility] duration-[240ms] ease-calm",
          open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
          "print:visible print:grid-rows-[1fr]",
        )}
      >
        {/* relative: absolutely positioned descendants (sr-only text) stay inside the clip instead of stretching the page */}
        <div className="relative min-h-0 overflow-hidden print:overflow-visible">
          <div className="border-t border-line">
            <CardDetails report={report} onHide={hide} />
          </div>
        </div>
      </div>
    </section>
  );
}
