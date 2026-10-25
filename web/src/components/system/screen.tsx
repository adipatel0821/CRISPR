import * as React from "react";
import { cn } from "@/lib/utils";

export interface ScreenProps {
  /** The page's one h1. Short, plain, sentence case. */
  title: React.ReactNode;
  /** Optional ONE supporting sentence under the h1. */
  lede?: React.ReactNode;
  /** Optional quiet line above the h1 (sentence case, never uppercase), e.g. the offer's label. */
  context?: React.ReactNode;
  /** id of the h1 (default "screen-title"); use it for aria-labelledby. */
  titleId?: string;
  /** Ref to the h1 (it has tabIndex -1) so a step change can move focus to the new heading. */
  headingRef?: React.Ref<HTMLHeadingElement>;
  /** Extra classes for the h1 (e.g. a smaller size for a long question). */
  titleClassName?: string;
  /** Screen content, stacked with generous spacing. */
  children?: React.ReactNode;
  /** Element for the wrapper (default "div"). */
  as?: "div" | "section" | "article";
  className?: string;
  /** Extra attributes for tests, e.g. { "data-screen": "intake" }. */
  "data-screen"?: string;
}

/**
 * One screen in the single 640 px column: an optional context line, exactly one h1, an optional one-line
 * lede, then the content with a consistent vertical rhythm (32 px between blocks). The layout's <main>
 * already sets the column width; Screen never adds cards or borders.
 */
export function Screen({
  title,
  lede,
  context,
  titleId = "screen-title",
  headingRef,
  titleClassName,
  children,
  as: Tag = "div",
  className,
  ...rest
}: ScreenProps) {
  return (
    <Tag className={cn("flex flex-col gap-8", className)} data-screen={rest["data-screen"]}>
      <div className="space-y-2">
        {context && <p className="text-sm text-ink-subtle">{context}</p>}
        <h1
          id={titleId}
          ref={headingRef}
          tabIndex={-1}
          className={cn(
            "text-balance text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink outline-none sm:text-title",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {lede && <p className="text-pretty text-lede text-ink-muted">{lede}</p>}
      </div>
      {children}
    </Tag>
  );
}
