import { useState } from 'react';
import { DraftView } from '@/components/draft-view';
import { IdeasView } from '@/components/ideas-view';
import { SettingsView } from '@/components/settings-view';
import { useDraftSession } from '@/hooks/use-draft-session';
import { useIdeaCapture } from '@/hooks/use-idea-capture';
import { usePendingAction } from '@/hooks/use-pending-action';
import { cn } from '@/lib/utils';

const TABS = ['draft', 'ideas', 'settings'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<Tab>('draft');
  const drafts = useDraftSession();
  const ideas = useIdeaCapture();

  usePendingAction((action) => {
    if (action.kind === 'idea') {
      setTab('ideas');
      void ideas.receive(action);
    } else {
      setTab('draft');
      drafts.receive(action);
    }
  });

  return (
    <main className="min-h-screen text-sm">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <span className="mr-auto font-semibold">twitter-craft</span>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn('rounded-md px-3 py-1 capitalize', tab === t ? 'bg-muted font-medium' : 'text-muted-foreground')}
          >
            {t}
          </button>
        ))}
      </header>
      {/* Draft and Ideas stay mounted so in-progress edits survive tab switches. Settings remounts to
          reload values changed elsewhere (e.g. voice samples) before the user can save over them. */}
      <div hidden={tab !== 'draft'}><DraftView {...drafts} /></div>
      <div hidden={tab !== 'ideas'}><IdeasView {...ideas} /></div>
      {tab === 'settings' && <SettingsView />}
    </main>
  );
}
