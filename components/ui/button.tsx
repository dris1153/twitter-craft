import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Neo-brutalist (DESIGN.md): 2px ink border, hard offset shadow that the button presses into on :active.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border-2 border-ink font-mono font-medium tracking-[0.02em] whitespace-nowrap transition-[translate,box-shadow,background-color] duration-(--duration-quick) ease-(--ease-smooth-out) motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-sky text-sky-ink hover:bg-sky/85",
        destructive: "bg-coral text-[#383838] hover:bg-coral/85",
        outline: "bg-surface text-ink hover:bg-sky-wash",
        secondary: "bg-subtle text-ink hover:bg-sky-wash",
        ghost: "border-transparent bg-transparent text-ink hover:bg-subtle",
        link: "border-transparent bg-transparent text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-[13px]",
        xs: "h-6 gap-1 border-[1.5px] px-2 text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 text-xs",
        lg: "h-10 px-6 text-sm",
        icon: "size-9",
        "icon-xs": "size-6 border-[1.5px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [
      {
        variant: ["default", "destructive", "outline", "secondary"],
        size: ["xs", "sm", "icon-xs", "icon-sm"],
        className: "shadow-brut-sm active:translate-x-[-2px] active:translate-y-[2px] active:shadow-none",
      },
      {
        variant: ["default", "destructive", "outline", "secondary"],
        size: ["default", "lg", "icon", "icon-lg"],
        className: "shadow-brut-md active:translate-x-[-4px] active:translate-y-[4px] active:shadow-none",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
