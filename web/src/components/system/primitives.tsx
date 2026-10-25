import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------------------------------------
 * Container: kept for existing call sites. Every width now resolves to the one 640 px column that the
 * layout already applies, so it only adds `mx-auto w-full`.
 * ---------------------------------------------------------------------------------------------- */
export function Container({
  width: _width = "results",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: "reading" | "results" }) {
  void _width;
  return <div className={cn("mx-auto w-full max-w-[40rem]", className)} {...props} />;
}

/* ------------------------------------------------------------------------------------------------
 * PageIntro: legacy page heading (screens move to <Screen>). The old eyebrow renders as a quiet
 * sentence-case context line, never uppercase.
 * ---------------------------------------------------------------------------------------------- */
export interface PageIntroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Heading level for the title (default "h1"). */
  as?: "h1" | "h2";
  align?: "left" | "center";
  /** Small actions shown beside the title on wide screens, below it on narrow ones. */
  actions?: React.ReactNode;
  id?: string;
  className?: string;
}

export function PageIntro({ eyebrow, title, lede, as: Tag = "h1", align = "left", actions, id, className }: PageIntroProps) {
  const center = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        actions && !center && "sm:flex-row sm:items-end sm:justify-between",
        center && "items-center text-center",
        className,
      )}
    >
      <div className={cn("min-w-0 space-y-2", center && "mx-auto max-w-xl")}>
        {eyebrow && <p className="text-sm text-ink-subtle">{eyebrow}</p>}
        <Tag id={id} className="text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-title">
          {title}
        </Tag>
        {lede && <p className="text-pretty text-lede text-ink-muted">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Insight: legacy statement block (screens move to <Answer> and <Note>). Flat, no border.
 * Tone is never the only signal: attention / gap add an icon and the label carries the meaning.
 * ---------------------------------------------------------------------------------------------- */
export type InsightTone = "neutral" | "attention" | "gap";

export interface InsightProps {
  /** Small label above the sentence. */
  label?: React.ReactNode;
  /** The one sentence. */
  children: React.ReactNode;
  /** Optional figure (pass formatted backend strings). */
  figure?: React.ReactNode;
  /** neutral (default), attention (amber), gap (rose: deficit / shortfall findings only). */
  tone?: InsightTone;
  /** Slot for a SourceLink / ProvenanceChip. */
  source?: React.ReactNode;
  /** Optional action link. */
  action?: { href: string; label: string } | React.ReactNode;
  /** Heading level used for the label (default: plain <p>). */
  labelAs?: "p" | "h2" | "h3";
  /** Show the tone icon (default true for attention / gap, false for neutral). */
  icon?: boolean;
  id?: string;
  className?: string;
}

const INSIGHT_TONE: Record<InsightTone, { wrap: string; label: string; Icon: typeof Info }> = {
  neutral: { wrap: "bg-canvas", label: "text-ink-subtle", Icon: Info },
  attention: { wrap: "bg-info-soft", label: "text-info", Icon: Info },
  gap: { wrap: "bg-deficit-soft", label: "text-deficit", Icon: AlertCircle },
};

function isLinkAction(a: unknown): a is { href: string; label: string } {
  return typeof a === "object" && a !== null && "href" in a && "label" in a && !React.isValidElement(a);
}

export function Insight({ label, children, figure, tone = "neutral", source, action, labelAs = "p", icon, id, className }: InsightProps) {
  const t = INSIGHT_TONE[tone];
  const showIcon = icon ?? tone !== "neutral";
  const LabelTag = labelAs;
  return (
    <div id={id} className={cn("print-card rounded-card p-5 sm:p-6", t.wrap, className)} data-tone={tone}>
      {label && (
        <LabelTag className={cn("mb-2 flex items-center gap-1.5 text-sm font-medium", t.label)}>
          {showIcon && <t.Icon aria-hidden className="size-4 shrink-0" />}
          {label}
        </LabelTag>
      )}
      <div className={cn("flex flex-col gap-3", figure && "sm:flex-row sm:items-end sm:justify-between sm:gap-6")}>
        <div className="min-w-0 text-pretty text-base leading-relaxed text-ink">{children}</div>
        {figure && <div className="figure shrink-0 text-2xl font-semibold tracking-tight text-ink">{figure}</div>}
      </div>
      {(source || action) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {source && <div className="min-w-0">{source}</div>}
          {action && (isLinkAction(action) ? <SecondaryLink href={action.href}>{action.label}</SecondaryLink> : action)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * KeyFigure: legacy figure + label, optional before → after (screens move to <Answer>).
 * Values must be formatted backend strings; this component never computes.
 * ---------------------------------------------------------------------------------------------- */
export interface KeyFigureProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  before?: React.ReactNode;
  after?: React.ReactNode;
  caption?: React.ReactNode;
  source?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}

export function KeyFigure({ label, value, before, after, caption, source, size = "md", className }: KeyFigureProps) {
  const big = size === "lg" ? "text-[2rem] sm:text-figure" : "text-2xl sm:text-[1.75rem]";
  const hasChange = before !== undefined && after !== undefined;
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      {hasChange ? (
        <p className={cn("figure flex flex-wrap items-baseline gap-x-2 font-semibold tracking-tight text-ink", big)}>
          <span className="sr-only">From </span>
          <span className="text-[0.62em] font-medium text-ink-subtle">{before}</span>
          <span aria-hidden className="text-[0.62em] font-normal text-ink-subtle">
            →
          </span>
          <span className="sr-only"> to </span>
          <span>{after}</span>
        </p>
      ) : (
        <p className={cn("figure font-semibold tracking-tight text-ink", big)}>{value}</p>
      )}
      {caption && <p className="text-sm leading-relaxed text-ink-muted">{caption}</p>}
      {source && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">{source}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * PrimaryAction: the ONE primary button or link on a screen state. Always carries data-primary-action
 * (tests and the density script count it). Charcoal, 48 px tall, full width on phones.
 * ---------------------------------------------------------------------------------------------- */
export interface PrimaryActionProps {
  children: React.ReactNode;
  /** Renders a Next <Link> when given (and not disabled), otherwise a <button>. */
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Shows the button as busy: disabled, aria-busy, and `pendingLabel` (if given) replaces the text. */
  pending?: boolean;
  pendingLabel?: React.ReactNode;
  /** Trailing arrow icon. Off by default (decorative). */
  arrow?: boolean;
  size?: "md" | "lg";
  /** Stretch to full width on small screens (default true). */
  block?: boolean;
  id?: string;
  /** Associates a submit button with a form elsewhere on the page. */
  form?: string;
  className?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
}

export function PrimaryAction({
  children,
  href,
  onClick,
  type = "button",
  disabled,
  pending = false,
  pendingLabel,
  arrow = false,
  size = "lg",
  block = true,
  id,
  form,
  className,
  ...aria
}: PrimaryActionProps) {
  const cls = cn(block && "w-full sm:w-auto", className);
  const inner = (
    <>
      {pending && pendingLabel ? pendingLabel : children}
      {arrow && <ArrowRight aria-hidden />}
    </>
  );
  if (href && !disabled && !pending) {
    return (
      <Button asChild size={size} className={cls}>
        <Link href={href} id={id} data-primary-action="" onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>} {...aria}>
          {inner}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      type={type}
      size={size}
      className={cls}
      id={id}
      form={form}
      data-primary-action=""
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...aria}
    >
      {inner}
    </Button>
  );
}

/** Quiet text link (accent). No arrow unless asked: arrows are not decoration. */
export function SecondaryLink({
  href,
  children,
  arrow = false,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  arrow?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1 rounded-sm text-[15px] font-medium text-accent-strong underline decoration-accent-line decoration-1 underline-offset-4 transition-colors duration-150 hover:decoration-current",
        className,
      )}
    >
      {children}
      {arrow && <ArrowRight aria-hidden className="size-3.5" />}
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------------
 * FadeIn: CSS-only entrance (opacity + 2 px rise, 180 ms). Reduced motion: no animation.
 * `step` staggers siblings by 50 ms each (0 to 4).
 * ---------------------------------------------------------------------------------------------- */
const DELAY = ["", "[animation-delay:50ms]", "[animation-delay:100ms]", "[animation-delay:150ms]", "[animation-delay:200ms]"];

export function FadeIn({
  as: Tag = "div",
  step = 0,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "li" | "article"; step?: 0 | 1 | 2 | 3 | 4 }) {
  return <Tag className={cn("animate-fade-in motion-reduce:animate-none", DELAY[step], className)} {...props} />;
}

/* ------------------------------------------------------------------------------------------------
 * EmptyNote: a quiet inline note for absent data. (New code: prefer <Note>.)
 * ---------------------------------------------------------------------------------------------- */
export function EmptyNote({
  title,
  children,
  action,
  className,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("rounded-card bg-canvas px-4 py-3.5 text-[15px] leading-relaxed text-ink-muted sm:px-5", className)}>
      {title && <p className="font-medium text-ink">{title}</p>}
      {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      {action && (
        <div className="mt-2">
          <SecondaryLink href={action.href}>{action.label}</SecondaryLink>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Section: a titled block (h2 + optional one-line description), generous spacing.
 * ---------------------------------------------------------------------------------------------- */
export function Section({
  title,
  description,
  id,
  as: Tag = "h2",
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
  as?: "h2" | "h3";
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-8 space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <Tag id={headingId} className="text-lg font-semibold tracking-tight text-ink">
            {title}
          </Tag>
          {description && <p className="text-[15px] leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
