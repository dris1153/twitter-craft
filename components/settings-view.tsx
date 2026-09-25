import { useEffect, useState, type ReactNode } from 'react';
import { ZodError } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { fromForm, toForm, type SettingsForm } from '@/lib/settings-form';
import { getSettings, saveSettings } from '@/lib/settings-store';
import { SettingsSchema } from '@/lib/types';

type TextKey = { [K in keyof SettingsForm]: SettingsForm[K] extends string ? K : never }[keyof SettingsForm];

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsView() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    getSettings()
      .then((s) => setForm(toForm(s)))
      .catch(() => {
        setForm(toForm(SettingsSchema.parse({})));
        setStatus('Could not load saved settings; showing defaults');
      });
  }, []);

  if (!form) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm({ ...form, [key]: value });
    setStatus('');
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
      setStatus('Saved');
    } catch (err) {
      const issue = err instanceof ZodError ? err.issues[0] : undefined;
      setStatus(issue ? `Invalid ${issue.path.join('.')}: ${issue.message}` : 'Save failed');
    }
  };

  return (
    <div className="space-y-6 p-4 pb-20">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">API keys & models</h2>
        {text('jevKey', 'Jev (TypeSafe) API key', { secret: true })}
        {text('openaiKey', 'OpenAI API key', { secret: true, hint: 'Use a project key with a monthly budget cap.' })}
        {text('draftModel', 'Draft model')}
        {text('ideaModel', 'Idea model')}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Triage</h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Voice</h2>
        {text('handle', 'Your @handle')}
        {text('persona', 'Persona', { rows: 4, hint: 'Who you are, what you work on, how you write.' })}
        {text('voiceSamples', 'Voice samples', { rows: 6, hint: 'Your own tweets/replies, separated by a line with ---' })}
        {text('bannedPhrases', 'Banned phrases', { rows: 4, hint: 'One per line.' })}
        {text('maxReplyChars', 'Max reply characters')}
        {text('readableLanguages', 'Languages you can review', { hint: 'Comma-separated codes. Others are drafted in English.' })}
        {text('ideaLanguage', 'Idea notes language', { hint: 'Language code for saved ideas, e.g. vi or en.' })}
      </section>

      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-background p-3">
        <Button onClick={() => void save()}>Save</Button>
        <span className="text-xs text-muted-foreground" role="status">
          {status}
        </span>
      </div>
    </div>
  );
}
