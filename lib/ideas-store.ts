import { storage } from 'wxt/utils/storage';
import { X_STATUS_URL, type Idea } from './types';

// ponytail: one array item; fine for hundreds of ideas (~2 KB each). Split per key if it ever gets big.
export const ideasItem = storage.defineItem<Idea[]>('local:ideas', { fallback: [] });

// Every write goes through one promise chain: two quick edits (e.g. notes blur + status change)
// would otherwise both read the same snapshot and the second write would erase the first.
let chain: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (ideas: Idea[]) => { next: Idea[]; result: T }): Promise<T> {
  const run = chain.then(async () => {
    const { next, result } = fn(await ideasItem.getValue());
    await ideasItem.setValue(next);
    return result;
  });
  chain = run.catch(() => {});
  return run;
}

export const listIdeas = () => ideasItem.getValue();

export async function findBySource(statusId: string): Promise<Idea | undefined> {
  return (await listIdeas()).find((i) => i.sourceStatusId === statusId);
}

// Returns the existing idea instead of adding a duplicate for the same tweet.
export function addIdea(idea: Idea): Promise<Idea> {
  if (!X_STATUS_URL.test(idea.sourceUrl)) return Promise.reject(new Error('Invalid source URL'));
  return mutate((ideas) => {
    const existing = ideas.find((i) => i.sourceStatusId === idea.sourceStatusId);
    return existing ? { next: ideas, result: existing } : { next: [idea, ...ideas], result: idea };
  });
}

export function updateIdea(id: string, patch: Partial<Omit<Idea, 'id' | 'sourceStatusId' | 'sourceUrl'>>): Promise<void> {
  return mutate((ideas) => ({ next: ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)), result: undefined }));
}

export function removeIdea(id: string): Promise<void> {
  return mutate((ideas) => ({ next: ideas.filter((i) => i.id !== id), result: undefined }));
}
