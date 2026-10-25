"use client";

import * as React from "react";
import Link from "next/link";
import { DropdownMenu as DM } from "radix-ui";
import { cn } from "@/lib/utils";

export interface MenuProps {
  /** The trigger: one <button> element (it receives aria-haspopup, aria-expanded and the open state). */
  trigger: React.ReactElement;
  /** MenuItem / MenuSeparator / MenuText children. */
  children: React.ReactNode;
  /** Accessible name of the menu list (defaults to the trigger's name). */
  label?: string;
  align?: "start" | "end";
  className?: string;
}

/**
 * Accessible menu button (Radix dropdown menu): Enter, Space and Arrow Down open it, arrow keys move between
 * items, typing jumps to an item, Escape closes it and focus returns to the trigger. Non-modal, so a dialog
 * opened from an item can take focus cleanly.
 */
export function Menu({ trigger, children, label, align = "end", className }: MenuProps) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
          className={cn(
            "z-50 min-w-[14rem] max-w-[calc(100vw-2rem)] rounded-card bg-surface p-1.5 text-[15px] text-ink shadow-overlay",
            "origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-fade-in",
            className,
          )}
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

const ITEM =
  "flex min-h-10 w-full cursor-pointer select-none items-center gap-2.5 rounded-control px-3 py-2 text-left outline-none transition-colors duration-150 data-[highlighted]:bg-canvas data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle";

export interface MenuItemProps {
  children: React.ReactNode;
  /** Runs when the item is chosen (click, Enter or Space). */
  onSelect?: () => void;
  /** Renders a Next <Link> instead of a button-like item. */
  href?: string;
  /** "danger" for destructive items (text only: the label carries the meaning). */
  tone?: "default" | "danger";
  /** Optional quiet second line. */
  hint?: React.ReactNode;
  disabled?: boolean;
  id?: string;
}

export function MenuItem({ children, onSelect, href, tone = "default", hint, disabled, id }: MenuItemProps) {
  const cls = cn(ITEM, tone === "danger" && "text-deficit [&_svg]:text-deficit");
  const body = hint ? (
    <span className="min-w-0">
      <span className="block">{children}</span>
      <span className="block text-sm text-ink-subtle">{hint}</span>
    </span>
  ) : (
    children
  );
  if (href && !disabled) {
    return (
      <DM.Item asChild onSelect={onSelect}>
        <Link href={href} id={id} className={cls}>
          {body}
        </Link>
      </DM.Item>
    );
  }
  return (
    <DM.Item id={id} className={cls} disabled={disabled} onSelect={onSelect}>
      {body}
    </DM.Item>
  );
}

export function MenuSeparator() {
  return <DM.Separator className="mx-1.5 my-1.5 h-px bg-line" />;
}

/** Non-interactive line inside a menu (e.g. the current loan). */
export function MenuText({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-3 pb-1.5 pt-1 text-sm text-ink-subtle">{children}</DM.Label>;
}
