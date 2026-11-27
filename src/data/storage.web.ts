/**
 * Web record storage: IndexedDB (via idb-keyval). One key per record.
 * Writes are awaited per change, so closing the tab right after an edit keeps it.
 */
import { createStore, delMany, entries, setMany } from 'idb-keyval';

import type { RecordStorage } from './storage-types';

const store = typeof indexedDB !== 'undefined' ? createStore('luma-calendar', 'records') : undefined;

export const recordStorage: RecordStorage = {
  async loadAll() {
    if (!store) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of await entries(store)) out[String(k)] = v;
    return out;
  },
  async putMany(list) {
    if (store && list.length) await setMany(list, store);
  },
  async removeMany(keys) {
    if (store && keys.length) await delMany(keys, store);
  },
  async requestPersistence() {
    // Ask the browser not to evict our data under storage pressure.
    try {
      if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch {
      // ignore
    }
    return false;
  },
};
