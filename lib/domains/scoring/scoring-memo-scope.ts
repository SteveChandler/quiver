import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { createScoringMemo, installScoringMemoSource, type ScoringMemo } from './scoring-memo';

const storage = new AsyncLocalStorage<ScoringMemo>();
installScoringMemoSource(() => storage.getStore());

/** Runs `fn` with one scoring memo; a nested call shares the outer request's memo. */
export function runWithScoringMemo<T>(fn: () => Promise<T>): Promise<T> {
  return storage.getStore() ? fn() : storage.run(createScoringMemo(), fn);
}
