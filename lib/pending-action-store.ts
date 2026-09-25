import { storage } from 'wxt/utils/storage';
import type { PendingAction } from './messages';

// Written only by the background SW (session storage is not exposed to content scripts).
export const pendingActionItem = storage.defineItem<PendingAction | null>('session:pendingAction', {
  fallback: null,
});
