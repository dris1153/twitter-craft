import { useEffect, useState } from 'react';
import { IdeaEditor } from '@/components/idea-editor';
import { Button } from '@/components/ui/button';
import { removeIdea, updateIdea } from '@/lib/ideas-store';
import { IDEA_STATUSES, X_STATUS_URL, type Idea, type IdeaStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export function IdeaRow({ idea, expanded, onToggle }: { idea: Idea; expanded: boolean; onToggle: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!expanded) setConfirmDelete(false);
  }, [expanded]);
  const report = (p: Promise<unknown>) => void p.then(() => setError(''), (e: unknown) => setError(`Could not save: ${String(e)}`));

  return (
    <li className={cn('rounded-lg border', idea.status === 'dropped' && 'opacity-60')}>
      <div className="flex items-start gap-2 p-3">
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium">{idea.title || 'Untitled idea'}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{idea.sourceAuthor} · {idea.createdAt.slice(0, 10)}
            {idea.tags.length > 0 && ` · ${idea.tags.join(', ')}`}
          </p>
        </button>
        <select
          aria-label="Status"
          value={idea.status}
          onChange={(e) => report(updateIdea(idea.id, { status: e.target.value as IdeaStatus }))}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          {IDEA_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {expanded && (
        <div className="space-y-3 border-t p-3">
          <IdeaEditor initial={idea} showNotes onCommit={(v) => report(updateIdea(idea.id, v))} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {X_STATUS_URL.test(idea.sourceUrl) && (
              <Button size="sm" variant="outline" asChild>
                <a href={idea.sourceUrl} target="_blank" rel="noreferrer">Open post</a>
              </Button>
            )}
            <Button
              size="sm"
              variant={confirmDelete ? 'destructive' : 'ghost'}
              onClick={() => (confirmDelete ? report(removeIdea(idea.id)) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Delete for good' : 'Delete'}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
