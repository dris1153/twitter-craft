import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Card } from '@/lib/types';

const HINT: Record<Card['kind'], string> = {
  insight: 'One takeaway per line (max 4)',
  code: 'Code (max 12 lines)',
  compare: 'First line: Column A | Column B. Then one row per line: label | A | B (max 5)',
};

const cells = (line: string) => line.split('|').map((c) => c.trim());

function bodyText(card: Card): string {
  if (card.kind === 'insight') return card.bullets.join('\n');
  if (card.kind === 'code') return card.code;
  return [`${card.columns.a} | ${card.columns.b}`, ...card.rows.map((r) => `${r.label} | ${r.a} | ${r.b}`)].join('\n');
}

function withBody(card: Card, text: string): Card {
  if (card.kind === 'insight') return { ...card, bullets: text.split('\n').filter((l) => l.trim()).slice(0, 4) };
  if (card.kind === 'code') return { ...card, code: text.split('\n').slice(0, 12).join('\n') };
  const [head = '', ...lines] = text.split('\n');
  const [a = '', b = ''] = cells(head);
  const rows = lines.filter((l) => l.trim()).slice(0, 5).map((l) => {
    const [label = '', ra = '', rb = ''] = cells(l);
    return { label, a: ra, b: rb };
  });
  return { ...card, columns: { a, b }, rows };
}

const LIMIT: Record<Card['kind'], number> = { insight: 4, code: 12, compare: 6 }; // compare: header + 5 rows

export function CardEditor({ card, onChange }: { card: Card; onChange: (card: Card) => void }) {
  // Keep the raw text so typing a half-finished "a |" line doesn't get reformatted under the cursor.
  const [body, setBody] = useState(() => bodyText(card));
  const lineCount = body.split('\n').filter((l) => card.kind === 'code' || l.trim()).length;
  return (
    <div className="space-y-2">
      <Input aria-label="Card title" value={card.title} onChange={(e) => onChange({ ...card, title: e.target.value })} />
      {card.kind === 'code' && (
        <Input aria-label="Language" value={card.lang} onChange={(e) => onChange({ ...card, lang: e.target.value })} />
      )}
      <Textarea
        aria-label={HINT[card.kind]}
        placeholder={HINT[card.kind]}
        rows={card.kind === 'code' ? 8 : 5}
        className={card.kind === 'code' ? 'font-mono text-xs' : ''}
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          onChange(withBody(card, e.target.value));
        }}
      />
      <p className="text-xs text-muted-foreground">
        {HINT[card.kind]}
        {lineCount > LIMIT[card.kind] && <span className="text-destructive"> · extra lines are left off the card</span>}
      </p>
    </div>
  );
}
