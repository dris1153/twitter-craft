import '@/assets/card-fonts.css';
import type { Ref } from 'react';
import type { Card } from '@/lib/types';

export type CardTheme = 'dark' | 'light';

// Fonts are bundled (remote fonts are blocked in extension pages and would not embed in the PNG).
const THEMES = {
  dark: { bg: 'linear-gradient(135deg, #0b1020 0%, #1b1235 100%)', fg: '#e7e9ea', muted: '#94a3b8', accent: '#7dd3fc', panel: 'rgba(255,255,255,0.06)' },
  light: { bg: 'linear-gradient(135deg, #ffffff 0%, #eef2f7 100%)', fg: '#0f172a', muted: '#64748b', accent: '#2563eb', panel: 'rgba(15,23,42,0.05)' },
} as const;

function Body({ card, t }: { card: Card; t: (typeof THEMES)[CardTheme] }) {
  if (card.kind === 'code') {
    return (
      <div style={{ background: t.panel }} className="rounded-xl p-5">
        {card.lang && <div style={{ color: t.muted }} className="mb-2 text-sm uppercase tracking-wider">{card.lang}</div>}
        <pre className="whitespace-pre-wrap break-words text-[17px] leading-relaxed" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
          {card.code}
        </pre>
      </div>
    );
  }
  if (card.kind === 'compare') {
    return (
      <div className="grid grid-cols-[1fr_1.4fr_1.4fr] gap-x-4 gap-y-3 text-[18px]">
        <div />
        <div style={{ color: t.accent }} className="font-bold">{card.columns.a}</div>
        <div style={{ color: t.accent }} className="font-bold">{card.columns.b}</div>
        {card.rows.map((r, i) => (
          <div key={i} className="contents">
            <div style={{ color: t.muted }}>{r.label}</div>
            <div>{r.a}</div>
            <div>{r.b}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-4 text-[21px] leading-snug">
      {card.bullets.map((b, i) => (
        <li key={i} className="flex gap-3">
          <span style={{ background: t.accent }} className="mt-[10px] size-2.5 shrink-0 rounded-full" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

// Fixed 600px wide; rendered at pixelRatio 2 → 1200px PNG.
export function ShareCard({ card, theme, handle, ref }: { card: Card; theme: CardTheme; handle: string; ref?: Ref<HTMLDivElement> }) {
  const t = THEMES[theme];
  return (
    <div ref={ref} style={{ width: 600, background: t.bg, color: t.fg, fontFamily: 'Inter, sans-serif' }} className="space-y-6 rounded-3xl p-10">
      {card.title && <h2 className="text-[30px] font-bold leading-tight">{card.title}</h2>}
      <Body card={card} t={t} />
      {handle && (
        <div style={{ color: t.muted }} className="flex items-center gap-2 pt-2 text-base">
          <span style={{ background: t.accent }} className="size-2 rounded-full" />@{handle.replace(/^@/, '')}
        </div>
      )}
    </div>
  );
}
