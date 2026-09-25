import { useState } from 'react';
import { Chip, PanelCard, type Accent } from '@/components/panel-card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Variant } from '@/hooks/use-draft-session';
import { checkDraft, WARNING_TEXT } from '@/lib/draft-safety-checks';
import type { InsertMode } from '@/lib/messages';
import type { Project, Triage, Tweet } from '@/lib/types';

type Props = {
  variant: Variant;
  ctx: { tweet: Tweet; triage: Triage | null; projects: Project[]; maxChars: number };
  busy: boolean;
  onChange: (text: string) => void;
  onInsert: (mode: InsertMode) => void;
  onCopy: () => void;
  onSaveSample: () => void;
};

// One accent per angle, like colored pencils in a cup (DESIGN.md rainbow palette, decoration only).
const ANGLE_ACCENT: Record<string, Accent> = { reaction: 'coral', question: 'periwinkle', take: 'mint', quote: 'lilac' };

export function DraftVariantEditor({ variant, ctx, busy, onChange, onInsert, onCopy, onSaveSample }: Props) {
  const [confirming, setConfirming] = useState<InsertMode | null>(null);
  const [saved, setSaved] = useState(false);
  const warnings = checkDraft(variant.text, ctx);
  const length = [...variant.text].length;
  const empty = variant.text.trim() === '';
  // Untouched model text could carry the stranger's influence into future instructions; require a human edit.
  const canSave = variant.inserted && !saved && !empty && variant.text.trim() !== variant.original.trim();

  const insert = (mode: InsertMode) => {
    // Warnings (planted links, unknown @handles, bait) need a second, deliberate click on the same button.
    if (warnings.length > 0 && confirming !== mode) {
      setConfirming(mode);
      return;
    }
    setConfirming(null);
    onInsert(mode);
  };

  const insertButton = (mode: InsertMode, label: string) => (
    <Button
      size="sm"
      disabled={empty || busy}
      variant={confirming === mode ? 'destructive' : mode === 'reply' ? 'default' : 'outline'}
      onClick={() => insert(mode)}
    >
      <span key={confirming === mode ? 'confirm' : 'idle'} className="t-text-swap">
        {confirming === mode ? `${label} anyway` : label}
      </span>
    </Button>
  );

  return (
    <PanelCard accent={ANGLE_ACCENT[variant.angle] ?? 'sky'} className="t-reveal-item space-y-3 pt-5">
      <div className="flex items-center justify-between">
        <Chip>{variant.angle}</Chip>
        <span className={`font-mono text-[11px] tabular-nums ${length > ctx.maxChars ? 'font-semibold text-danger' : 'text-ink-muted'}`}>
          {length}/{ctx.maxChars}
        </span>
      </div>
      <Textarea
        rows={3}
        value={variant.text}
        onChange={(e) => {
          setConfirming(null);
          setSaved(false);
          onChange(e.target.value);
        }}
      />
      {warnings.length > 0 && (
        <ul className="space-y-0.5 rounded-sm border-[1.5px] border-ink bg-canary px-2.5 py-1.5 text-[11px] text-[#383838]">
          {warnings.map((w) => (
            <li key={w}>⚠ {WARNING_TEXT[w]}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        {insertButton('reply', 'Reply')}
        {insertButton('quote', 'Quote')}
        <Button size="sm" variant="ghost" disabled={empty} onClick={onCopy}>
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-ink-muted"
          disabled={!canSave}
          title="After you edit and insert a reply, keep it as an example of your writing style"
          onClick={() => {
            onSaveSample();
            setSaved(true);
          }}
        >
          {saved ? 'Saved ✓' : 'Save voice'}
        </Button>
      </div>
    </PanelCard>
  );
}
