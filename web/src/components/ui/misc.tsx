"use client";

import * as React from "react";
import { AlertDialog as AD, Checkbox as CB, Dialog as DG, Switch as SW, Tabs as T } from "radix-ui";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("dt-skeleton", className)} {...props} />;
}

/* ---------------- Checkbox ---------------- */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CB.Root>) {
  return (
    <CB.Root
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-field-line bg-surface transition-colors duration-150",
        "data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-white",
        className,
      )}
      {...props}
    >
      <CB.Indicator>
        <Check className="size-3.5" strokeWidth={3} />
      </CB.Indicator>
    </CB.Root>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({ className, ...props }: React.ComponentProps<typeof SW.Root>) {
  return (
    <SW.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-field-line bg-subtle transition-colors duration-150",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-white ring-1 ring-line-strong transition-transform duration-150 data-[state=checked]:translate-x-[1.1rem] data-[state=checked]:ring-0" />
    </SW.Root>
  );
}

/* ---------------- Tabs ---------------- */
export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex w-full gap-1 rounded-card bg-canvas p-1 sm:w-auto", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "flex-1 rounded-control px-4 py-2 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink sm:flex-none",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-soft",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = T.Content;

/* ---------------- Confirm dialog ---------------- */
/**
 * Confirmation for a consequential action. Uncontrolled with a `trigger`, or controlled with
 * `open` + `onOpenChange` (for example opened from a menu item).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  danger = false,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = open !== undefined;
  return (
    <AD.Root {...(controlled ? { open, onOpenChange } : {})}>
      {trigger && <AD.Trigger asChild>{trigger}</AD.Trigger>}
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-fade-in" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-6 shadow-overlay data-[state=open]:animate-fade-in">
          <AD.Title className="text-lg font-semibold tracking-tight text-ink">{title}</AD.Title>
          <AD.Description className="mt-2 text-base leading-relaxed text-ink-muted">{description}</AD.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel className={buttonVariants({ variant: "secondary" })}>{cancelLabel}</AD.Cancel>
            <AD.Action className={buttonVariants({ variant: danger ? "danger" : "primary" })} onClick={() => void onConfirm()}>
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}

/* ---------------- Dialog (information) ---------------- */
/**
 * A calm modal panel for reading (for example "About this analysis"). Focus is trapped while open, Escape
 * closes it, and focus returns to whatever opened it. Controlled.
 */
export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  closeLabel = "Close",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One short sentence under the title (also the dialog's accessible description). */
  description?: React.ReactNode;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  return (
    <DG.Root open={open} onOpenChange={onOpenChange}>
      <DG.Portal>
        <DG.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-fade-in" />
        <DG.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-surface p-6 shadow-overlay data-[state=open]:animate-fade-in">
          <div className="flex items-start justify-between gap-4">
            <DG.Title className="text-lg font-semibold tracking-tight text-ink">{title}</DG.Title>
            <DG.Close
              aria-label={closeLabel}
              className="-mr-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-subtle transition-colors duration-150 hover:bg-canvas hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </DG.Close>
          </div>
          {description ? (
            <DG.Description className="mt-1.5 text-base leading-relaxed text-ink-muted">{description}</DG.Description>
          ) : (
            <DG.Description className="sr-only">{title}</DG.Description>
          )}
          <div className="mt-5 text-[15px] leading-relaxed text-ink-muted">{children}</div>
        </DG.Content>
      </DG.Portal>
    </DG.Root>
  );
}
