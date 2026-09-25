import type { Ref } from 'react';
import type { Card } from '@/lib/types';

// DESIGN.md card: white on cream paper, 2px charcoal border, hard -6px 6px shadow, mono type, a canary
// status tag. Literal colors on purpose: the PNG must look the same whatever the side panel theme is.
const C = { paper: '#f4efea', surface: '#ffffff', chalk: '#f8f8f7', ink: '#383838', muted: '#818181', sky: '#6fc2ff', wash: '#ebf9ff', canary: '#ffde00' };
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const TAG: Record<Card['kind'], string> = { insight: 'TL;DR', code: 'CODE', compare: 'VS' };
const RULE = `1.5px solid ${C.ink}`;

function Body({ card }: { card: Card }) {
  if (card.kind === 'code') {
    return (
      <div style={{ background: C.chalk, border: RULE, borderRadius: 2 }} className="p-5">
        {card.lang && (
          <span style={{ border: `1px solid ${C.ink}`, borderRadius: 2 }} className="mb-3 inline-block px-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase">
            {card.lang}
          </span>
        )}
        <pre className="text-[16px] leading-relaxed wrap-break-word whitespace-pre-wrap" style={{ fontFamily: MONO }}>{card.code}</pre>
      </div>
    );
  }
  if (card.kind === 'compare') {
    const head = { background: C.wash, borderLeft: RULE };
    return (
      <div style={{ border: RULE, borderRadius: 2 }} className="grid grid-cols-[1fr_1.4fr_1.4fr] text-[16px]">
        <div style={{ background: C.wash }} />
        <div style={head} className="px-3 py-2 font-semibold">{card.columns.a}</div>
        <div style={head} className="px-3 py-2 font-semibold">{card.columns.b}</div>
        {card.rows.map((r, i) => (
          <div key={i} className="contents">
            <div style={{ borderTop: RULE, color: C.muted }} className="px-3 py-2">{r.label}</div>
            <div style={{ borderTop: RULE, borderLeft: RULE }} className="px-3 py-2">{r.a}</div>
            <div style={{ borderTop: RULE, borderLeft: RULE }} className="px-3 py-2">{r.b}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-3.5 text-[18px] leading-snug">
      {card.bullets.map((b, i) => (
        <li key={i} className="flex gap-3">
          <span style={{ background: C.sky, border: RULE }} className="mt-1.75 size-2.5 shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// Fixed 600px logical width → 1200px PNG at pixelRatio 2. The cream padding keeps the hard shadow inside the image.
export function ShareCard({ card, handle, ref }: { card: Card; handle: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} style={{ width: 600, background: C.paper, padding: '24px 24px 30px 30px', fontFamily: MONO, color: C.ink, letterSpacing: '0.02em' }}>
      <div style={{ background: C.surface, border: `2px solid ${C.ink}`, borderRadius: 2, boxShadow: `-6px 6px 0 0 ${C.ink}` }} className="space-y-5 p-8">
        <span style={{ background: C.canary, border: `1px solid ${C.ink}`, borderRadius: 2 }} className="inline-block px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em]">
          {TAG[card.kind]}
        </span>
        {card.title && <h2 className="text-[24px] leading-tight font-semibold">{card.title}</h2>}
        <Body card={card} />
        {handle && (
          <div style={{ borderTop: `1px solid ${C.ink}`, color: C.muted }} className="pt-3 text-[13px]">
            @{handle.replace(/^@/, '')}
          </div>
        )}
      </div>
    </div>
  );
}
