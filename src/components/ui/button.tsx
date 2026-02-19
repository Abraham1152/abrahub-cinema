import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lime hover:shadow-lime-intense",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-transparent hover:bg-secondary hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Studio themed variants
        studio: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lime hover:shadow-lime-intense hover:scale-[1.02] active:scale-[0.98]",
        "studio-outline": "border-2 border-primary text-primary bg-transparent hover:bg-primary/10 hover:shadow-glow-sm",
        "studio-ghost": "text-muted-foreground hover:text-primary hover:bg-primary/5",
        "studio-glass": "bg-secondary/50 backdrop-blur-md border border-border text-foreground hover:bg-secondary/70 hover:border-primary/30",
        // Legacy cinema variants mapped to studio
        cinema: "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-lime hover:shadow-lime-intense hover:scale-[1.02] active:scale-[0.98]",
        "cinema-outline": "border-2 border-primary text-primary bg-transparent hover:bg-primary/10 hover:shadow-glow-sm",
        "cinema-ghost": "text-muted-foreground hover:text-primary hover:bg-primary/5",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        xl: "h-14 rounded-xl px-8 text-lg font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };