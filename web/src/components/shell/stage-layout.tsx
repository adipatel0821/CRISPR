import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/* ================================================================================================
 * StageLayout: the two-panel application layout inside the white surface.
 *   >= 1024 px: left rail clamp(280px, 24%, 400px) + workspace (padding clamp(32px, 4vw, 80px)).
 *   <  1024 px: the rail collapses to a compact bar (stage title + progress) with a "Your answers" /
 *               "Your loan" disclosure holding the context and steps; content stacks; ActionRow docks.
 * Slots are plain props so each screen decides what its rail shows.
 * ============================================================================================== */

export interface StageLayoutProps {
  /** Stage title in the rail, e.g. "Your money". Not a heading level 1 (the workspace owns the h1). */
  stage: React.ReactNode;
  /** One quiet line under the stage title. */
  stageNote?: React.ReactNode;
  /** Progress element, usually <RailProgress />. Shown in the rail and in the compact bar. */
  progress?: React.ReactNode;
  /** Relevant answers or loan context, e.g. <RailFacts />. */
  context?: React.ReactNode;
  /** Navigation to completed steps, e.g. <RailSteps />. */
  steps?: React.ReactNode;
  /** Pinned at the bottom of the rail. Default: <StartOverLink />. Pass null to hide. */
  railFooter?: React.ReactNode;
  /** Label of the mobile disclosure that holds context + steps (default "Your answers"). */
  mobileSummaryLabel?: string;
  /** The workspace content (the question or the result). */
  children: React.ReactNode;
  /** Bottom action row, usually <ActionRow />. Docks to the bottom of the viewport below 1024 px. */
  actions?: React.ReactNode;
  className?: string;
  workspaceClassName?: string;
}

export function StageLayout({
  stage,
  stageNote,
  progress,
  context,
  steps,
  railFooter,
  mobileSummaryLabel = "Your answers",
  children,
  actions,
  className,
  workspaceClassName,
}: StageLayoutProps) {
  const footer = railFooter === undefined ? <StartOverLink /> : railFooter;
  const hasSummary = Boolean(context || steps);
  return (
    <div data-stage-layout="" className={cn("flex w-full flex-1 flex-col lg:flex-row", className)}>
      {/* Desktop rail */}
      <aside
        data-stage-rail=""
        aria-label="Progress and context"
        className="hidden shrink-0 flex-col border-r border-line lg:flex lg:w-[var(--rail-width)]"
      >
        <div className="sticky top-0 flex max-h-dvh min-h-[calc(100dvh-var(--header-height))] flex-col gap-8 px-8 py-10 xl:px-10">
          <div className="space-y-2">
            <p className="text-[1.375rem] font-extrabold leading-tight tracking-[-0.015em] text-ink">{stage}</p>
            {stageNote && <p className="text-[15px] leading-relaxed text-ink-2">{stageNote}</p>}
          </div>
          {progress}
          {context && <div className="min-w-0">{context}</div>}
          {steps && <div className="min-w-0">{steps}</div>}
          {footer && <div className="mt-auto pt-6">{footer}</div>}
        </div>
      </aside>

      {/* Compact bar below 1024 px */}
      <div data-stage-rail="" className="border-b border-line px-4 pb-4 pt-5 sm:px-6 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-[-0.01em] text-ink">{stage}</p>
            {stageNote && <p className="text-sm text-ink-2">{stageNote}</p>}
          </div>
          {footer && <div className="shrink-0">{footer}</div>}
        </div>
        {progress && <div className="mt-3">{progress}</div>}
        {hasSummary && (
          <details className="dt-disclosure group mt-3 rounded-control bg-canvas">
            <summary className="flex min-h-11 items-center justify-between gap-2 px-4 text-[15px] font-semibold text-ink">
              {mobileSummaryLabel}
              <ChevronDown aria-hidden className="dt-chevron size-4 text-ink-2" />
            </summary>
            <div className="space-y-5 px-4 pb-4 pt-1">
              {context}
              {steps}
            </div>
          </details>
        )}
      </div>

      {/* Workspace */}
      <div data-stage-workspace="" className="flex min-w-0 flex-1 flex-col">
        <div className={cn("flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:p-[var(--workspace-pad)]", workspaceClassName)}>
          {children}
        </div>
        {actions}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * RailProgress: "Step 2 of 6" + a slim bar (role=progressbar). Counts only, never money.
 * ---------------------------------------------------------------------------------------------- */
export function RailProgress({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const text = label ?? `Step ${Math.min(value + 1, max)} of ${max}`;
  return (
    <div className="space-y-2">
      <p className="tabular text-sm font-semibold text-ink-2">{text}</p>
      <div
        role="progressbar"
        aria-label={text}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-subtle"
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * RailSteps: the stage's steps, Peddle-style list with chevrons. Done steps link back and wear a yellow check, the
 * current one is marked (aria-current + bold + blue + "Current" for screen readers), later ones are muted text.
 * ---------------------------------------------------------------------------------------------- */
export interface RailStep {
  label: string;
  href?: string;
  /** done: visited and linkable; current: this screen; todo: not reached yet (link optional). */
  state: "done" | "current" | "todo";
  /** Optional short detail under the label, e.g. "$375.14 a month". */
  detail?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

export function RailSteps({ steps, label = "Steps" }: { steps: RailStep[]; label?: string }) {
  return (
    <nav aria-label={label} data-journey="">
      <ol className="divide-y divide-line border-y border-line">
        {steps.map((s) => {
          const Icon = s.icon;
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                {s.state === "done" ? (
                  // Finished steps: a black check in a yellow circle (the current step stays blue).
                  <span
                    aria-hidden
                    data-step-done=""
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sun text-sun-ink"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                ) : Icon ? (
                  <Icon aria-hidden className={cn("size-5 shrink-0", s.state === "current" ? "text-brand" : "text-ink-3")} />
                ) : (
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      s.state === "current" ? "bg-brand ring-4 ring-brand-tint" : "bg-line-strong",
                    )}
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate">{s.label}</span>
                  {s.detail && <span className="tabular block text-sm font-normal text-ink-2">{s.detail}</span>}
                </span>
              </span>
              {s.href && s.state !== "current" && <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />}
              {s.state === "current" && <span className="sr-only">(current step)</span>}
              {s.state === "done" && <span className="sr-only">(done)</span>}
            </>
          );
          const cls = cn(
            "flex min-h-14 w-full items-center justify-between gap-3 py-3 text-[16px]",
            s.state === "current" ? "font-bold text-brand-strong" : s.state === "done" ? "font-semibold text-ink" : "text-ink-3",
          );
          return (
            <li key={s.label}>
              {s.href && s.state !== "current" ? (
                <Link href={s.href} className={cn(cls, "rounded-sm transition-colors duration-150 hover:text-brand-strong")}>
                  {body}
                </Link>
              ) : (
                <div className={cls} aria-current={s.state === "current" ? "step" : undefined}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------------------------------------
 * RailFacts: the answers / loan terms so far, each with an optional edit link or button.
 * Values are formatted backend or user values (never computed here).
 * ---------------------------------------------------------------------------------------------- */
export interface RailFact {
  label: string;
  value: React.ReactNode;
  /** Edit target: a link or a callback. The accessible name becomes "Edit {label}". */
  edit?: { href: string } | { onClick: () => void };
}

export function RailFacts({ title, facts, empty }: { title?: string; facts: RailFact[]; empty?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title && <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-ink-3">{title}</p>}
      {facts.length === 0 ? (
        empty ? <p className="text-[15px] text-ink-2">{empty}</p> : null
      ) : (
        <dl className="space-y-2.5">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-3">
              <dt className="min-w-0 text-[15px] text-ink-2">{f.label}</dt>
              <dd className="flex shrink-0 items-baseline gap-2">
                <span className="tabular text-[15px] font-semibold text-ink">{f.value}</span>
                {f.edit &&
                  ("href" in f.edit ? (
                    <Link href={f.edit.href} aria-label={`Edit ${f.label}`} className="dt-link text-sm">
                      Edit
                    </Link>
                  ) : (
                    <button type="button" onClick={f.edit.onClick} aria-label={`Edit ${f.label}`} className="dt-link text-sm">
                      Edit
                    </button>
                  ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** Quiet "Start over" pill (back to the welcome screen, where Start begins a new session). */
export function StartOverLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      data-start-over=""
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full bg-canvas px-4 text-[15px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-subtle hover:text-ink",
        className,
      )}
    >
      <RotateCcw aria-hidden className="size-4" />
      Start over
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------------
 * ActionRow: the bottom action row of a workspace. Quiet Back on the left, the yellow PrimaryAction on the
 * right (pass it as children). Below 1024 px it docks to the bottom of the viewport.
 * ---------------------------------------------------------------------------------------------- */
export function ActionRow({
  back,
  secondary,
  children,
  className,
}: {
  /** Quiet back action: a link or a callback. */
  back?: { href: string; label?: string } | { onClick: () => void; label?: string };
  /** Optional quiet actions between Back and the primary action (e.g. Skip). */
  secondary?: React.ReactNode;
  /** The PrimaryAction. */
  children?: React.ReactNode;
  className?: string;
}) {
  const backLabel = back?.label ?? "Back";
  const backCls =
    "inline-flex h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-canvas hover:text-ink";
  return (
    <div
      data-action-row=""
      className={cn(
        "no-print sticky bottom-0 z-20 border-t border-line bg-surface/95 px-4 py-3 shadow-dock backdrop-blur sm:px-6 lg:static lg:bg-surface lg:px-[var(--workspace-pad)] lg:py-6 lg:shadow-none",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Secondary items yield by wrapping, never by truncating or by squeezing the primary pill (D5-002). */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {back &&
            ("href" in back ? (
              <Link href={back.href} className={backCls}>
                <ArrowLeft aria-hidden className="size-4" />
                {backLabel}
              </Link>
            ) : (
              <button type="button" onClick={back.onClick} className={backCls}>
                <ArrowLeft aria-hidden className="size-4" />
                {backLabel}
              </button>
            ))}
          {secondary}
        </div>
        {/* grow (basis auto), not flex-1: when Back + a secondary action leave too little room on a phone, the
            primary pill wraps to its own line instead of being squeezed. No min-w-0: the pill never shrinks below
            its label (D5-002). */}
        {children && <div className="ml-auto flex grow justify-end sm:flex-none">{children}</div>}
      </div>
    </div>
  );
}
