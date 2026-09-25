import { useState } from 'react';
import { DraftView } from '@/components/draft-view';
import { IdeasView } from '@/components/ideas-view';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { SettingsView } from '@/components/settings-view';
import { useDraftSession } from '@/hooks/use-draft-session';
import { useIdeaCapture } from '@/hooks/use-idea-capture';
import { usePendingAction } from '@/hooks/use-pending-action';

const TABS = [
  { value: 'draft', label: 'Draft' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'settings', label: 'Settings' },
] as const;
type Tab = (typeof TABS)[number]['value'];

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
    <main className="min-h-screen bg-paper text-[13px] text-ink">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-ink bg-surface px-4 py-2.5">
        <span className="mr-auto flex items-center gap-2 font-mono whitespace-nowrap text-[13px] font-semibold tracking-[0.02em]">
          <span aria-hidden className="size-2.5 rounded-[1px] border-[1.5px] border-ink bg-sky" />
          twitter-craft
        </span>
        <SegmentedTabs label="Sections" options={TABS} value={tab} onChange={setTab} />
      </header>
      {/* Draft and Ideas stay mounted so in-progress edits survive tab switches. Settings remounts to
          reload values changed elsewhere (e.g. voice samples) before the user can save over them. */}
      <div hidden={tab !== 'draft'}><DraftView {...drafts} /></div>
      <div hidden={tab !== 'ideas'}><IdeasView {...ideas} /></div>
      {tab === 'settings' && <SettingsView />}
    </main>
  );
}
