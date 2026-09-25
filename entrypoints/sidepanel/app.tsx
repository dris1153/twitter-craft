import { useState } from 'react';
import { DraftView } from '@/components/draft-view';
import { SettingsView } from '@/components/settings-view';
import { useDraftSession } from '@/hooks/use-draft-session';
import { usePendingAction } from '@/hooks/use-pending-action';
import { cn } from '@/lib/utils';

type Tab = 'draft' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('draft');
  const [notice, setNotice] = useState('');
  const drafts = useDraftSession();

  usePendingAction((action) => {
    setTab('draft');
    if (action.kind === 'idea') {
      setNotice('Saving ideas to the TODO list arrives in the next update.');
      return;
    }
    setNotice('');
    drafts.receive(action);
  });

  return (
    <main className="min-h-screen text-sm">
      <header className="flex items-center gap-1 border-b px-3 py-2">
        <span className="mr-auto font-semibold">twitter-craft</span>
        {(['draft', 'settings'] as const).map((t) => (
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
      {notice && <p className="border-b px-4 py-2 text-xs text-muted-foreground">{notice}</p>}
      {tab === 'draft' ? <DraftView {...drafts} /> : <SettingsView />}
    </main>
  );
}
