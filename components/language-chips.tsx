import { LANGUAGES } from '@/lib/languages';
import { cn } from '@/lib/utils';

// Multi-select as toggle chips. Codes outside LANGUAGES that are already saved stay in the value untouched.
export function LanguageChips({ value, onChange, labelledBy }: { value: string[]; onChange: (codes: string[]) => void; labelledBy: string }) {
  const extra = value.filter((c) => !LANGUAGES.some((l) => l.code === c)).map((code) => ({ code, native: code }));
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {[...LANGUAGES, ...extra].map((l) => {
        const on = value.includes(l.code);
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((c) => c !== l.code) : [...value, l.code])}
            className={cn(
              'rounded-sm border-[1.5px] border-ink px-2 py-0.5 text-xs shadow-brut-sm transition-[translate,box-shadow,background-color] duration-(--duration-quick) ease-(--ease-smooth-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky active:translate-x-[-2px] active:translate-y-[2px] active:shadow-none motion-reduce:transition-none',
              on ? 'bg-sky text-sky-ink' : 'bg-surface text-ink hover:bg-sky-wash',
            )}
          >
            {l.native}
          </button>
        );
      })}
    </div>
  );
}
