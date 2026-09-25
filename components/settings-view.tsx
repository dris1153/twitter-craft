import { useEffect, useState, type ReactNode } from 'react';
import { ZodError } from 'zod';
import { LanguageChips } from '@/components/language-chips';
import { PanelCard, SectionTitle } from '@/components/panel-card';
import { Button } from '@/components/ui/button';
import { fieldClasses, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useLang, useT } from '@/hooks/use-i18n';
import { LANGUAGES, UI_LANGUAGES, type UiLanguage } from '@/lib/languages';
import { fromForm, toForm, type SettingsForm } from '@/lib/settings-form';
import { getSettings, saveSettings, setUiLanguage } from '@/lib/settings-store';
import { SettingsSchema } from '@/lib/types';
import { cn } from '@/lib/utils';

type TextKey = { [K in keyof SettingsForm]: SettingsForm[K] extends string ? K : never }[keyof SettingsForm];

const SELECT = cn('h-9 px-2', fieldClasses);
const nativeName = (code: string) => LANGUAGES.find((l) => l.code === code)?.native ?? code;

// group: the control is not a single labelable element (chips), so it uses aria-labelledby instead of for.
function Field({ id, label, hint, group, children }: { id: string; label: string; hint?: string; group?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={group ? undefined : id} id={`${id}-label`}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function SettingsView() {
  const t = useT();
  // Display language comes from the live setting, not the form: another window may have changed it.
  const lang = useLang();
  const [form, setForm] = useState<SettingsForm | null>(null);
  // error > 0 marks a failure; bumping it remounts the message so the shake replays.
  const [status, setStatus] = useState({ text: '', error: 0 });
  const fail = (text: string) => setStatus((s) => ({ text, error: s.error + 1 }));

  useEffect(() => {
    getSettings()
      .then((s) => setForm(toForm(s)))
      .catch(() => {
        setForm(toForm(SettingsSchema.parse({})));
        setStatus({ text: t('settings.loadFailed'), error: 1 });
      });
  }, []);

  if (!form) return <p className="p-4 text-xs text-ink-muted">{t('settings.loading')}</p>;

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

  const changeUiLanguage = (next: UiLanguage) => {
    setUiLanguage(next).catch(() => fail(t('settings.saveFailed')));
  };

  const save = async () => {
    try {
      await saveSettings(fromForm({ ...form, uiLanguage: lang }));
      setStatus({ text: t('settings.saved'), error: 0 });
    } catch (err) {
      const issue = err instanceof ZodError ? err.issues[0] : undefined;
      fail(issue ? t('settings.invalid', { path: issue.path.join('.'), message: issue.message }) : t('settings.saveFailed'));
    }
  };

  return (
    <div className="space-y-5 p-4 pb-24">
      <PanelCard accent="canary" className="space-y-4 pt-5">
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <Field id="uiLanguage" label={t('settings.uiLanguage')} hint={t('settings.uiLanguageHint')}>
          <select id="uiLanguage" className={SELECT} value={lang} onChange={(e) => changeUiLanguage(e.target.value as UiLanguage)}>
            {UI_LANGUAGES.map((code) => <option key={code} value={code} lang={code}>{nativeName(code)}</option>)}
          </select>
        </Field>
        <Field id="readableLanguages" group label={t('settings.readableLanguages')} hint={t('settings.readableLanguagesHint')}>
          <LanguageChips value={form.readableLanguages} onChange={(v) => set('readableLanguages', v)} labelledBy="readableLanguages-label" />
        </Field>
        <Field id="ideaLanguage" label={t('settings.ideaLanguage')}>
          <select id="ideaLanguage" className={SELECT} value={form.ideaLanguage} onChange={(e) => set('ideaLanguage', e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code} lang={l.code}>{l.native}</option>)}
            {!LANGUAGES.some((l) => l.code === form.ideaLanguage) && <option value={form.ideaLanguage}>{form.ideaLanguage}</option>}
          </select>
        </Field>
      </PanelCard>

      <PanelCard accent="sky" className="space-y-4 pt-5">
        <SectionTitle>{t('settings.keys')}</SectionTitle>
        {text('jevKey', t('settings.jevKey'), { secret: true })}
        {text('openaiKey', t('settings.openaiKey'), { secret: true, hint: t('settings.openaiKeyHint') })}
        {text('draftModel', t('settings.draftModel'))}
        {text('ideaModel', t('settings.ideaModel'))}
      </PanelCard>

      <PanelCard accent="mint" className="space-y-4 pt-5">
        <SectionTitle>{t('settings.triage')}</SectionTitle>
        {text('interests', t('settings.interests'), { rows: 4, hint: t('settings.interestsHint') })}
        {text('projects', t('settings.projects'), { rows: 4, hint: t('settings.projectsHint') })}
        {text('minQuality', t('settings.minQuality'))}
        <div className="flex items-center justify-between">
          <Label htmlFor="dim">{t('settings.dim')}</Label>
          <Switch id="dim" checked={form.dimLowScore} onCheckedChange={(v) => set('dimLowScore', v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="debug">{t('settings.debug')}</Label>
          <Switch id="debug" checked={form.debug} onCheckedChange={(v) => set('debug', v)} />
        </div>
      </PanelCard>

      <PanelCard accent="lilac" className="space-y-4 pt-5">
        <SectionTitle>{t('settings.voice')}</SectionTitle>
        {text('handle', t('settings.handle'))}
        {text('persona', t('settings.persona'), { rows: 4, hint: t('settings.personaHint') })}
        {text('voiceSamples', t('settings.voiceSamples'), { rows: 6, hint: t('settings.voiceSamplesHint') })}
        {text('bannedPhrases', t('settings.bannedPhrases'), { rows: 4, hint: t('settings.bannedPhrasesHint') })}
        {text('maxReplyChars', t('settings.maxReplyChars'))}
      </PanelCard>

      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t-2 border-ink bg-surface px-4 py-3">
        <Button onClick={() => void save()}>{t('settings.save')}</Button>
        <span role="status" className="min-w-0 text-xs">
          <span key={status.error} className={cn('inline-block', status.error ? 't-shake text-danger' : 'text-ink-muted')}>
            {status.text}
          </span>
        </span>
      </div>
    </div>
  );
}
