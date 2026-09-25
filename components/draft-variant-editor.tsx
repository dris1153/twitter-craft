import { useState } from 'react';
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
      variant={confirming === mode ? 'destructive' : mode === 'reply' ? 'default' : 'secondary'}
      onClick={() => insert(mode)}
    >
      {confirming === mode ? `${label} anyway` : label}
    </Button>
  );

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{variant.angle}</span>
        <span className={length > ctx.maxChars ? 'text-destructive' : ''}>
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
        <ul className="space-y-0.5 text-xs text-destructive">
          {warnings.map((w) => (
            <li key={w}>⚠ {WARNING_TEXT[w]}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {insertButton('reply', 'Reply')}
        {insertButton('quote', 'Quote')}
        <Button size="sm" variant="outline" disabled={empty} onClick={onCopy}>
          Copy
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canSave}
          title="After you edit and insert a reply, keep it as an example of your writing style"
          onClick={() => {
            onSaveSample();
            setSaved(true);
          }}
        >
          {saved ? 'Saved as voice sample' : 'Save as voice sample'}
        </Button>
      </div>
    </div>
  );
}
