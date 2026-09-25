import { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type Option<T extends string> = { value: T; label: string };

// Segmented control with a sky "pill" that slides to the active option (transitions.dev tabs sliding).
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // Tabs may wrap onto several rows, so the pill follows both offsets and the tab's size.
  const move = (animate: boolean) => {
    const tab = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const p = pill.current;
    if (!tab || !p) return;
    if (!animate) p.style.transition = 'none';
    p.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    p.style.width = `${tab.offsetWidth}px`;
    p.style.height = `${tab.offsetHeight}px`;
    if (!animate) {
      void p.offsetWidth; // commit the snap before re-enabling the tween
      p.style.transition = '';
    }
  };

  useLayoutEffect(() => {
    move(placed.current);
    placed.current = true;
  }, [value, options]);

  // One observer for the component's life: recreating it per change would snap away the slide.
  // Snaps (no tween) when the bar resizes, e.g. counts change, the panel resizes, or a hidden tab shows.
  useEffect(() => {
    const observer = new ResizeObserver(() => move(false));
    if (bar.current) observer.observe(bar.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={bar} role="tablist" aria-label={label} className={cn('relative inline-flex flex-wrap items-center gap-0.5 rounded-sm border-2 border-ink bg-subtle p-0.5', className)}>
      <span ref={pill} aria-hidden className="t-tabs-pill absolute top-0 left-0 size-0 rounded-[1px] border-[1.5px] border-ink bg-sky" />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            't-tab relative z-10 h-7 shrink-0 rounded-[1px] px-3 whitespace-nowrap font-mono text-xs font-medium tracking-[0.02em]',
            o.value === value ? 'text-sky-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
