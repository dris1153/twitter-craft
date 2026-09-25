import { useEffect, useState, type ReactNode } from 'react';
import { ZodError } from 'zod';
import { PanelCard, SectionTitle } from '@/components/panel-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fromForm, toForm, type SettingsForm } from '@/lib/settings-form';
import { getSettings, saveSettings } from '@/lib/settings-store';
import { SettingsSchema } from '@/lib/types';
import { cn } from '@/lib/utils';

type TextKey = { [K in keyof SettingsForm]: SettingsForm[K] extends string ? K : never }[keyof SettingsForm];

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function SettingsView() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  // error > 0 marks a failure; bumping it remounts the message so the shake replays.
  const [status, setStatus] = useState({ text: '', error: 0 });

  useEffect(() => {
    getSettings()
      .then((s) => setForm(toForm(s)))
      .catch(() => {
        setForm(toForm(SettingsSchema.parse({})));
        setStatus({ text: 'Could not load saved settings; showing defaults', error: 1 });
      });
  }, []);

  if (!form) return <p className="p-4 text-xs text-ink-muted">Loading…</p>;

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm({ ...form, [key]: value });
    setStatus({ text: '', error: 0 });
  };
  const text = (key: TextKey, label: string, opts: { hint?: string; secret?: boolean; rows?: number } = {}) => (
    <Field id={key} label={label} hint={opts.hint}>
      {opts.rows ? (
        <Textarea id={key} rows={opts.rows} value={form[key]} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <Input
          id={key}
          type={opts.secret ? 'password' : 'text'}
          autoComplete="off"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </Field>
  );

  const save = async () => {
    try {
      await saveSettings(fromForm(form));
      setStatus({ text: 'Saved', error: 0 });
    } catch (err) {
      const issue = err instanceof ZodError ? err.issues[0] : undefined;
      const text = issue ? `Invalid ${issue.path.join('.')}: ${issue.message}` : 'Save failed';
      setStatus((s) => ({ text, error: s.error + 1 }));
    }
  };

  return (
    <div className="space-y-5 p-4 pb-24">
      <PanelCard accent="sky" className="space-y-4 pt-5">
        <SectionTitle>API keys & models</SectionTitle>
        {text('jevKey', 'Jev (TypeSafe) API key', { secret: true })}
        {text('openaiKey', 'OpenAI API key', { secret: true, hint: 'Use a project key with a monthly budget cap.' })}
        {text('draftModel', 'Draft model')}
        {text('ideaModel', 'Idea model')}
      </PanelCard>

      <PanelCard accent="mint" className="space-y-4 pt-5">
        <SectionTitle>Triage</SectionTitle>
        {text('interests', 'Interests', { rows: 4, hint: 'One per line. Shapes how Jev scores quality.' })}
        {text('projects', 'Your projects', { rows: 4, hint: 'One per line: name | description | url' })}
        {text('minQuality', 'Dim tweets below priority (0-100)')}
        <div className="flex items-center justify-between">
          <Label htmlFor="dim">Dim low-priority tweets</Label>
          <Switch id="dim" checked={form.dimLowScore} onCheckedChange={(v) => set('dimLowScore', v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="debug">Debug (log answers, Copy HTML button)</Label>
          <Switch id="debug" checked={form.debug} onCheckedChange={(v) => set('debug', v)} />
        </div>
      </PanelCard>

      <PanelCard accent="lilac" className="space-y-4 pt-5">
        <SectionTitle>Voice</SectionTitle>
        {text('handle', 'Your @handle')}
        {text('persona', 'Persona', { rows: 4, hint: 'Who you are, what you work on, how you write.' })}
        {text('voiceSamples', 'Voice samples', { rows: 6, hint: 'Your own tweets/replies, separated by a line with ---' })}
        {text('bannedPhrases', 'Banned phrases', { rows: 4, hint: 'One per line.' })}
        {text('maxReplyChars', 'Max reply characters')}
        {text('readableLanguages', 'Languages you can review', { hint: 'Comma-separated codes. Others are drafted in English.' })}
        {text('ideaLanguage', 'Idea notes language', { hint: 'Language code for saved ideas, e.g. vi or en.' })}
      </PanelCard>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t-2 border-ink bg-surface px-4 py-3">
        <Button onClick={() => void save()}>Save</Button>
        <span role="status" className="min-w-0 text-xs">
          <span key={status.error} className={cn('inline-block', status.error ? 't-shake text-danger' : 'text-ink-muted')}>
            {status.text}
          </span>
        </span>
      </div>
    </div>
  );
}
