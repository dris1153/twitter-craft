import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { IdeaDraft } from '@/lib/types';

export type IdeaFields = IdeaDraft & { notes?: string };

type Form = Record<'title' | 'problem' | 'insight' | 'mvpScope' | 'stack' | 'promo' | 'tags' | 'notes', string>;

const splitLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const splitComma = (s: string) => s.split(',').map((l) => l.trim()).filter(Boolean);

function toForm(v: IdeaFields): Form {
  return { ...v, mvpScope: v.mvpScope.join('\n'), stack: v.stack.join(', '), tags: v.tags.join(', '), notes: v.notes ?? '' };
}

function fromForm(f: Form): IdeaFields {
  return {
    title: f.title.trim(), problem: f.problem.trim(), insight: f.insight.trim(), promo: f.promo.trim(),
    mvpScope: splitLines(f.mvpScope), stack: splitComma(f.stack), tags: splitComma(f.tags).map((t) => t.toLowerCase()),
    notes: f.notes,
  };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-ink-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

// onChange: every keystroke (new idea before saving). onCommit: autosave for saved ideas, on blur and
// 800 ms after typing stops, only when something actually changed.
export function IdeaEditor({ initial, showNotes, onChange, onCommit }: {
  initial: IdeaFields;
  showNotes: boolean;
  onChange?: (v: IdeaFields) => void;
  onCommit?: (v: IdeaFields) => void;
}) {
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const committed = useRef(JSON.stringify(fromForm(toForm(initial))));
  const commit = (f: Form) => {
    const value = fromForm(f);
    const key = JSON.stringify(value);
    if (!onCommit || key === committed.current) return;
    committed.current = key;
    onCommit(value);
  };
  useEffect(() => {
    if (!onCommit) return;
    const timer = setTimeout(() => commit(form), 800);
    return () => clearTimeout(timer);
  }, [form]);
  const bind = (key: keyof Form) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => {
      const next = { ...form, [key]: e.target.value };
      setForm(next);
      onChange?.(fromForm(next));
    },
    onBlur: () => commit(form),
  });

  return (
    <div className="space-y-3">
      <Row label="Title"><Input {...bind('title')} /></Row>
      <Row label="Problem"><Textarea rows={2} {...bind('problem')} /></Row>
      <Row label="Insight from the post"><Textarea rows={2} {...bind('insight')} /></Row>
      <Row label="MVP steps (one per line)"><Textarea rows={4} {...bind('mvpScope')} /></Row>
      <Row label="Stack (comma-separated)"><Input {...bind('stack')} /></Row>
      <Row label="How to share it on X"><Textarea rows={2} {...bind('promo')} /></Row>
      <Row label="Tags (comma-separated)"><Input {...bind('tags')} /></Row>
      {showNotes && <Row label="Your notes"><Textarea rows={3} {...bind('notes')} /></Row>}
    </div>
  );
}
