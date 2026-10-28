import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all motion-reduce:transition-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        anomaly: "bg-anomaly-soft text-anomaly-text border-transparent",
        warning: "bg-warning-soft text-warning-text border-transparent",
        ok: "bg-ok-soft text-ok-text border-transparent",
        inverse: "bg-inverse text-inverse-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// Hardware state is never conveyed by color alone: status variants carry an icon.
const STATUS_ICONS = {
  anomaly: TriangleAlert,
  warning: CircleAlert,
  ok: CircleCheck,
} as const;

function Badge({
  className,
  variant = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="badge"
        data-variant={variant}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  const Icon =
    variant && variant in STATUS_ICONS
      ? STATUS_ICONS[variant as keyof typeof STATUS_ICONS]
      : null;

  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" data-icon="inline-start" /> : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
