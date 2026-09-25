import { SettingsView } from '@/components/settings-view';

export function App() {
  return (
    <main className="min-h-screen text-sm">
      <header className="border-b px-4 py-3 font-semibold">twitter-craft</header>
      <SettingsView />
    </main>
  );
}
