import * as React from "react";
import { Info, ReceiptText, Trash2, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;

/**
 * TrustLine: one short, honest statement with a small icon in a soft yellow circle (ink icon, decorative). The same
 * look marks every "how much to trust this" line: the welcome trust strip and the "Illustrative scenario, not a
 * prediction" labels.
 */
export function TrustLine({
  icon: Icon = Info,
  children,
  as: Tag = "p",
  className,
}: {
  icon?: IconType;
  children: React.ReactNode;
  as?: "p" | "li" | "span";
  className?: string;
}) {
  return (
    <Tag data-trust-line="" className={cn("flex items-center gap-2.5 text-[15px] font-semibold leading-snug text-ink-2", className)}>
      <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sun-soft text-sun-ink">
        <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 text-balance">{children}</span>
    </Tag>
  );
}

/*
 * Only statements that are true of this product: there is no sign-in, every figure has a "How we got this" source,
 * and "Delete my data" (menu and report) removes the session from the server. No ratings, counts, logos or badges.
 */
const TRUST = [
  { icon: UserRoundX, text: "No account needed" },
  { icon: ReceiptText, text: "Every number shows its source" },
  { icon: Trash2, text: "Delete your data any time" },
] as const;

/** TrustStrip: the welcome page's three plain facts, three even columns on wide screens and stacked on phones. */
export function TrustStrip({ className }: { className?: string }) {
  return (
    <ul data-trust-strip="" aria-label="Good to know" className={cn("grid gap-3 sm:grid-cols-3 sm:gap-x-4", className)}>
      {TRUST.map((t) => (
        <TrustLine key={t.text} as="li" icon={t.icon} className="gap-2 text-[14px]">
          {t.text}
        </TrustLine>
      ))}
    </ul>
  );
}
