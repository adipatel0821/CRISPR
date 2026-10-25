import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-[15px] font-medium",
    "transition-[background-color,color,border-color,opacity] duration-150 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** The one primary action on a screen: charcoal. Prefer <PrimaryAction>, which also marks it for tests. */
        primary: "bg-primary text-primary-ink hover:bg-primary-hover",
        /** Quiet bordered action. */
        secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
        /** Soft fill, no border. */
        soft: "bg-canvas text-ink hover:bg-subtle",
        ghost: "text-ink-muted hover:bg-canvas hover:text-ink",
        danger: "border border-deficit-line bg-surface text-deficit hover:bg-deficit-soft",
        link: "rounded-sm text-accent-strong underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
      },
    },
    // links read as inline text: no fixed height / padding
    compoundVariants: [{ variant: "link", size: ["sm", "md", "lg"], className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
