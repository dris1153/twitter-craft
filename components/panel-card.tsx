import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Accent colors are decoration only (DESIGN.md): stripes and chips, never filled actions.
export const ACCENTS = {
  sky: 'var(--sky)',
  canary: 'var(--canary)',
  coral: 'var(--coral)',
  periwinkle: 'var(--periwinkle)',
  mint: 'var(--mint)',
  marigold: 'var(--marigold)',
  slate: 'var(--slate)',
  lilac: 'var(--lilac)',
} as const;
export type Accent = keyof typeof ACCENTS;

// White card, 2px ink border, hard shadow; optional accent stripe along the top edge.
export function PanelCard({
  accent,
  elevated = true,
  className,
  children,
  ...props
}: { accent?: Accent; elevated?: boolean; children: ReactNode } & ComponentProps<'section'>) {
  return (
    <section
      className={cn('relative rounded-sm border-2 border-ink bg-surface p-4', elevated && 'shadow-brut-md', className)}
      {...props}
    >
      {accent && <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: ACCENTS[accent] }} />}
      {children}
    </section>
  );
}

// Small uppercase tag (DESIGN.md "status badge"); filled only when it marks a state.
export function Chip({ fill, className, children }: { fill?: Accent; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm border-[1.5px] border-ink px-1.5 py-px font-mono text-[10px] leading-4 font-semibold tracking-[0.06em] uppercase',
        fill ? 'text-[#383838]' : 'text-ink',
        className,
      )}
      style={fill ? { background: ACCENTS[fill] } : undefined}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-mono text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{children}</h2>;
}
