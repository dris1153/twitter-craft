import { useEffect, useState } from 'react';
import { IdeaEditor } from '@/components/idea-editor';
import { ACCENTS, type Accent } from '@/components/panel-card';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/use-i18n';
import { removeIdea, updateIdea } from '@/lib/ideas-store';
import { IDEA_STATUSES, X_STATUS_URL, type Idea, type IdeaStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_ACCENT: Record<IdeaStatus, Accent> = { new: 'sky', reviewing: 'marigold', doing: 'mint', dropped: 'slate' };

export function IdeaRow({ idea, expanded, onToggle }: { idea: Idea; expanded: boolean; onToggle: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const t = useT();
  // The editor stays mounted after closing so the accordion can animate the close. Each open bumps
  // the key, so the form reloads from the stored idea (it may have changed in another window).
  const [openSeq, setOpenSeq] = useState(expanded ? 1 : 0);
  const [wasExpanded, setWasExpanded] = useState(expanded);
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded);
    if (expanded) setOpenSeq(openSeq + 1);
  }
  useEffect(() => {
    if (!expanded) setConfirmDelete(false);
  }, [expanded]);
  const report = (p: Promise<unknown>) => void p.then(() => setError(''), (e: unknown) => setError(t('common.couldNotSave', { error: String(e) })));

  return (
    <li
      data-open={expanded}
      className={cn('t-acc rounded-sm border-2 border-ink bg-surface shadow-brut-sm', idea.status === 'dropped' && 'opacity-60')}
    >
      <div className="flex items-start gap-2 p-3">
        <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{idea.title || t('ideas.untitled')}</span>
            <span className="block truncate text-[11px] text-ink-muted">
              @{idea.sourceAuthor} · {idea.createdAt.slice(0, 10)}
              {idea.tags.length > 0 && ` · ${idea.tags.join(', ')}`}
            </span>
          </span>
          <svg aria-hidden viewBox="0 0 16 16" className="t-acc-chevron mt-1 size-3.5 shrink-0 fill-none stroke-current stroke-2">
            <path d="M4 6.5L8 10.5L12 6.5" />
          </svg>
        </button>
        <select
          aria-label={t('ideas.status')}
          value={idea.status}
          onChange={(e) => report(updateIdea(idea.id, { status: e.target.value as IdeaStatus }))}
          style={{ background: ACCENTS[STATUS_ACCENT[idea.status]] }}
          className="rounded-sm border-[1.5px] border-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.06em] text-[#383838] uppercase"
        >
          {IDEA_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>
      </div>

      <div className="t-acc-panel" inert={!expanded}>
        <div className="t-acc-panel-inner">
          {openSeq > 0 && (
            <div className="space-y-3 border-t-2 border-ink p-3">
              <IdeaEditor key={openSeq} initial={idea} showNotes onCommit={(v) => report(updateIdea(idea.id, v))} />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex flex-wrap gap-2">
                {X_STATUS_URL.test(idea.sourceUrl) && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={idea.sourceUrl} target="_blank" rel="noreferrer">{t('ideas.openPost')}</a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={confirmDelete ? 'destructive' : 'ghost'}
                  onClick={() => (confirmDelete ? report(removeIdea(idea.id)) : setConfirmDelete(true))}
                >
                  <span key={String(confirmDelete)} className="t-text-swap">{confirmDelete ? t('ideas.confirmDelete') : t('ideas.delete')}</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
