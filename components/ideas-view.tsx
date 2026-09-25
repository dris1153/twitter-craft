import { useState } from 'react';
import { IdeaEditor } from '@/components/idea-editor';
import { IdeaRow } from '@/components/idea-row';
import { PanelCard } from '@/components/panel-card';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { Button } from '@/components/ui/button';
import type { useIdeaCapture } from '@/hooks/use-idea-capture';
import { useIdeas } from '@/hooks/use-idea-capture';
import { ideasToMarkdown } from '@/lib/ideas-markdown-export';
import { getSettings } from '@/lib/settings-store';
import { IDEA_STATUSES, type Idea, type IdeaStatus } from '@/lib/types';

type Filter = 'all' | IdeaStatus;

async function exportMarkdown(ideas: Idea[]) {
  const settings = await getSettings();
  const md = ideasToMarkdown(ideas, settings.projects.map((p) => p.url));
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `twitter-craft-ideas-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CaptureCard(props: ReturnType<typeof useIdeaCapture> & { onShowExisting: (id: string) => void }) {
  const { capture, queued, edit, save, discard, retry, acceptQueued, dismissQueued, onShowExisting } = props;
  if (!capture && !queued) return null;
  const who = capture ? `@${capture.tweet.authorHandle}` : '';
  return (
    <PanelCard accent="canary" className="space-y-3 pt-5">
      {queued && (
        <div className="space-y-2 rounded-sm border-2 border-ink bg-canary p-2.5 text-xs text-[#383838]">
          <p>New idea from @{queued.tweet.authorHandle}. Discard your unsaved edits?</p>
          <div className="flex gap-2">
            <Button size="xs" onClick={acceptQueued}>Switch</Button>
            <Button size="xs" variant="outline" onClick={dismissQueued}>Keep editing</Button>
          </div>
        </div>
      )}
      {capture?.status === 'loading' && (
        <p className="t-shimmer text-xs" data-text={`Turning ${who}'s post into an idea…`}>Turning {who}'s post into an idea…</p>
      )}
      {capture?.status === 'error' && (
        <div className="space-y-2">
          <p className="rounded-sm border-2 border-ink bg-coral/25 p-2.5 text-xs">{capture.error}</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={retry}>Retry</Button>
            <Button size="sm" variant="ghost" onClick={discard}>Dismiss</Button>
          </div>
        </div>
      )}
      {capture?.status === 'duplicate' && (
        <div className="flex items-center gap-2">
          <p className="flex-1">You already saved an idea from this post.</p>
          <Button size="sm" onClick={() => { onShowExisting(capture.existingId!); discard(); }}>Show it</Button>
        </div>
      )}
      {capture?.status === 'ready' && capture.draft && (
        <>
          <p className="text-xs text-ink-muted">New idea from {who}. Edit, then save to your TODO list.</p>
          <IdeaEditor key={capture.seq} initial={capture.draft} showNotes={false} onChange={edit} />
          {capture.error && <p className="text-xs text-danger">{capture.error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void save()}>Save to TODO</Button>
            <Button size="sm" variant="ghost" onClick={discard}>Discard</Button>
          </div>
        </>
      )}
    </PanelCard>
  );
}

export function IdeasView(props: ReturnType<typeof useIdeaCapture>) {
  const ideas = useIdeas();
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const shown = filter === 'all' ? ideas : ideas.filter((i) => i.status === filter);
  const count = (f: Filter) => (f === 'all' ? ideas.length : ideas.filter((i) => i.status === f).length);

  return (
    <div className="space-y-4 p-4">
      <CaptureCard
        {...props}
        onShowExisting={(id) => {
          setFilter('all');
          setExpanded(id);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedTabs
          label="Filter ideas"
          options={(['all', ...IDEA_STATUSES] as const).map((f) => ({ value: f, label: `${f} ${count(f)}` }))}
          value={filter}
          onChange={setFilter}
        />
        <Button size="sm" variant="outline" className="ml-auto" disabled={shown.length === 0} onClick={() => void exportMarkdown(shown)}>
          Export .md
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-sm border-2 border-dashed border-ink/40 p-4 text-center text-xs text-ink-muted">
          No ideas yet. Click "Idea" on a tweet badge to capture one.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              expanded={expanded === idea.id}
              onToggle={() => setExpanded(expanded === idea.id ? null : idea.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
