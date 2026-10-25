import { Activity, Car, CreditCard, HandCoins, Info, ListChecks, PiggyBank, ShoppingCart, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBadge, SpotBudget, SpotCompare, SpotSavings, type BadgeTone } from "@/components/visual";
import type { QuestionArtKind } from "./wording";

const ICONS = {
  income: Wallet,
  spending: ShoppingCart,
  debts: CreditCard,
  savings: PiggyBank,
  down: HandCoins,
  car: Car,
  varies: Activity,
  other: ListChecks,
} as const;

/** The lucide icon that stands for a question type (used in the eyebrow badge and the picture). */
export function artIcon(kind: QuestionArtKind) {
  return ICONS[kind] ?? ListChecks;
}

/**
 * Decorative picture beside the question, using the spare width on wide screens: an original spot illustration
 * for the question's topic with its icon. Hidden from assistive technology (the question says it all).
 */
export function QuestionArt({ kind, acknowledge, className }: { kind: QuestionArtKind; acknowledge?: boolean; className?: string }) {
  const Spot = kind === "savings" || kind === "down" ? SpotSavings : kind === "car" || kind === "other" ? SpotCompare : SpotBudget;
  const tone: BadgeTone = acknowledge ? "caution" : kind === "savings" || kind === "down" ? "savings" : "brand";
  const Icon = acknowledge ? Info : artIcon(kind);
  return (
    <div aria-hidden className={cn("relative items-center justify-center", className)} data-question-art="">
      <div
        className={cn(
          "relative flex aspect-square w-full max-w-[20rem] items-center justify-center rounded-[2.5rem]",
          acknowledge ? "bg-caution-soft" : kind === "savings" || kind === "down" ? "bg-savings-soft/60" : "bg-brand-tint/70",
        )}
      >
        <Spot className="w-[78%]" />
        <span className="absolute -left-4 top-8 rounded-full bg-surface p-1.5 shadow-soft">
          <IconBadge icon={Icon} tone={tone} size="lg" />
        </span>
        <span className="absolute -bottom-3 right-10 size-6 rounded-full bg-cta" />
        <span className="absolute right-6 top-6 size-3 rounded-full bg-brand-line" />
      </div>
    </div>
  );
}
