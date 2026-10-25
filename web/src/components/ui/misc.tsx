"use client";

import * as React from "react";
import { AlertDialog as AD, Checkbox as CB, Switch as SW, Tabs as T } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-subtle", className)} {...props} />;
}

/* ---------------- Checkbox ---------------- */
export function Checkbox({ className, ...props }: React.ComponentProps<typeof CB.Root>) {
  return (
    <CB.Root
      className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface transition-colors duration-150",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-white",
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
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-line-strong bg-line transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.1rem]" />
    </SW.Root>
  );
}

/* ---------------- Tabs ---------------- */
export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn("inline-flex w-full gap-1 rounded-full bg-canvas p-1 sm:w-auto", className)}
      {...props}
    />
  );
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "flex-1 rounded-full px-4 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:text-ink sm:flex-none",
        "data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-soft",
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = T.Content;

/* ---------------- Confirm dialog ---------------- */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = false,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}) {
  return (
    <AD.Root>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px]" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-line bg-surface p-6 shadow-soft data-[state=open]:animate-fade-in">
          <AD.Title className="text-base font-semibold text-ink">{title}</AD.Title>
          <AD.Description className="mt-2 text-sm text-ink-muted">{description}</AD.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel className={buttonVariants({ variant: "secondary" })}>Cancel</AD.Cancel>
            <AD.Action
              className={buttonVariants({ variant: danger ? "danger" : "primary" })}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
