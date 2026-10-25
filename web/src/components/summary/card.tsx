"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { DecisionReport } from "@/lib/contracts";
import { triggeredFlags } from "@/lib/report";
import { cn } from "@/lib/utils";
import { CardDetails, mainConcern } from "./details";
import { CardTop } from "./hero";

const DETAILS_ID = "card-details";
/** Hashes that open the details: the region itself, the old breakdown anchor, and sections inside it. */
const OPEN_ON = new Set(["details", "breakdown", DETAILS_ID, "assumptions", "loan-cost", "look-next", "savings", "flags", "unknowns", "sources"]);
/** Matches the height transition below; used only where the browser can't report the transition itself. */
const OPEN_MS = 260;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function currentHash(): string | null {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return null;
  }
}

/**
 * Drops a details hash (#assumptions, #details, ...) from the address without a navigation. The card opens when
 * the hash CHANGES, so without this the same "See all assumptions" link does nothing after the card is closed.
 */
function clearDetailsHash() {
  const h = currentHash();
  if (h === null || !OPEN_ON.has(h)) return;
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
}

/**
 * Runs fn once the details have finished opening (their height transition, which is near instant under reduced
 * motion), so whatever is measured or scrolled to is at its final place. Returns a cancel function.
 */
function afterOpen(fn: () => void): () => void {
  let cancelled = false;
  const run = () => {
    if (!cancelled) fn();
  };
  const el = document.getElementById(DETAILS_ID);
  if (!el || typeof el.getAnimations !== "function") {
    const timer = window.setTimeout(run, reducedMotion() ? 0 : OPEN_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }
  // getAnimations() flushes styles, so a transition the open state just started is included.
  const opening = el.getAnimations().filter((a) => (a as CSSTransition).transitionProperty === "grid-template-rows");
  // A transition cut short (the card closed again) rejects; the cleanup has cancelled by then.
  Promise.all(opening.map((a) => a.finished)).then(run, run);
  return () => {
    cancelled = true;
  };
}

/** The line under "Show all details": what opens, with the flag count and whether there is a main concern. */
function detailsHint(report: DecisionReport): string {
  const flags = triggeredFlags(report).length;
  const parts = ["What the loan costs", mainConcern(report) ? "the main concern" : "what to look at next", "your savings"];
  if (flags > 0) parts.push(flags === 1 ? "1 flag" : `${flags} flags`);
  parts.push("assumptions");
  return `${parts.join(", ")} and every source.`;
}

/** What to bring into view once the card has opened: a section named by the URL, or the details under the button. */
type Reveal = { kind: "section"; id: string } | { kind: "details" };

/**
 * The decision summary as ONE result card. The result sits at the top and is always visible; everything else
 * (cost, the main concern, options, savings, flags, assumptions, unknowns, every source) is behind one button
 * that expands the same card in place. The details stay in the DOM while closed (inert and hidden), print
 * expanded, and open by themselves when the page is reached at #details, #breakdown or one of their sections.
 */
export function ResultCard({ report }: { report: DecisionReport }) {
  const [open, setOpen] = React.useState(false);
  const [reveal, setReveal] = React.useState<Reveal | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const sync = () => {
      const h = currentHash();
      if (h === null || !OPEN_ON.has(h)) return;
      setOpen(true);
      setReveal({ kind: "section", id: h === "details" || h === "breakdown" ? DETAILS_ID : h });
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Runs after the open state is committed and waits for the height transition, so the page is tall enough to scroll.
  React.useEffect(() => {
    if (!open || !reveal) return;
    return afterOpen(() => {
      setReveal(null);
      if (reveal.kind === "section") {
        document.getElementById(reveal.id)?.scrollIntoView({ block: "start" });
        return;
      }
      // Opened with the button: when the details start low on the screen (below the fold, or behind the action
      // docked at the bottom), bring the button to the top so the first details show right under it.
      const details = document.getElementById(DETAILS_ID);
      if (details && details.getBoundingClientRect().top > window.innerHeight * 0.7) {
        toggleRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
      }
    });
  }, [open, reveal]);

  const close = React.useCallback(() => {
    clearDetailsHash();
    setReveal(null);
    setOpen(false);
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }
    setOpen(true);
    setReveal({ kind: "details" });
  };

  const hide = React.useCallback(() => {
    close();
    const t = toggleRef.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  }, [close]);

  return (
    <section
      data-result-card=""
      aria-labelledby="summary-title"
      className="min-w-0 overflow-clip rounded-[1.75rem] border border-line bg-surface shadow-soft print:overflow-visible print:rounded-none print:border-0"
    >
      <CardTop report={report} />

      <div className="no-print border-t border-line">
        {/* The ring is drawn inside the button (the card clips its edges); "!" because the global :focus-visible
            rule is not in a layer and would otherwise win over these utilities. */}
        <button
          ref={toggleRef}
          type="button"
          id="card-toggle"
          data-card-toggle=""
          aria-expanded={open}
          aria-controls={DETAILS_ID}
          aria-describedby="card-toggle-hint"
          onClick={toggle}
          className="group/toggle flex min-h-20 w-full scroll-mt-4 items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-subtle focus-visible:rounded-[1.5rem]! focus-visible:outline-offset-[-4px]! sm:px-8 xl:px-10"
        >
          <span className="min-w-0">
            <span className="block text-[18px] font-extrabold leading-snug text-ink">{open ? "Hide details" : "Show all details"}</span>
            <span id="card-toggle-hint" aria-hidden className="mt-0.5 block text-pretty text-[15px] leading-snug text-ink-2">
              {detailsHint(report)}
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
