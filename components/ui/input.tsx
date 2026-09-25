import * as React from "react"
import { cn } from "@/lib/utils"

// DESIGN.md: no focus glow; focus shows as a sky border plus a small hard sky shadow.
export const fieldClasses =
  "w-full min-w-0 rounded-sm border-2 border-ink bg-surface font-mono text-[13px] tracking-[0.02em] text-ink outline-none transition-[border-color,box-shadow] duration-(--duration-quick) ease-(--ease-smooth-out) motion-reduce:transition-none placeholder:text-ink-muted focus-visible:border-sky focus-visible:shadow-[-2px_2px_0_0_var(--sky)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn("h-9 px-3 py-1", fieldClasses, className)}
      {...props}
    />
  )
}

export { Input }
