import { useEffect, useRef } from 'react';
import type { PendingAction } from '@/lib/messages';
import { pendingActionItem } from '@/lib/pending-action-store';

const MAX_AGE_MS = 60_000;

// Read on mount (panel was closed when the badge was clicked) AND watch (panel already open).
// Each nonce is handled once, only by the panel in the window that clicked, then cleared.
export function usePendingAction(onAction: (action: PendingAction) => void): void {
  const callback = useRef(onAction);
  callback.current = onAction;

  useEffect(() => {
    let active = true;
    let windowId: number | undefined;
    const handled = new Set<string>();
    const handle = (a: PendingAction | null) => {
      if (!active || !a || windowId === undefined || a.windowId !== windowId || handled.has(a.nonce)) return;
      handled.add(a.nonce);
      void pendingActionItem.setValue(null);
      if (Date.now() - a.at <= MAX_AGE_MS) callback.current(a);
    };
    const unwatch = pendingActionItem.watch(handle);
    void browser.windows.getCurrent().then(async (w) => {
      windowId = w.id;
      handle(await pendingActionItem.getValue());
    });
    return () => {
      active = false;
      unwatch();
    };
  }, []);
}
