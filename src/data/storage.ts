/**
 * Native (Android/iOS) record storage: SQLite-backed key-value store.
 * Same contract as storage.web.ts. Each record is its own key, so a crash
 * mid-write can never corrupt other records.
 *
 * NOTE (M1): the app is tested on the web. This adapter compiles but is only
 * exercised on device from M4 (Android build).
 */
import Storage from 'expo-sqlite/kv-store';

import type { RecordStorage } from './storage-types';

export const recordStorage: RecordStorage = {
  async loadAll() {
    const keys = await Storage.getAllKeys();
    const pairs = await Storage.multiGet(keys);
    const out: Record<string, unknown> = {};
    for (const [k, v] of pairs) {
      if (v != null) out[k] = JSON.parse(v);
    }
    return out;
  },
  async putMany(entries) {
    for (const [k, v] of entries) await Storage.setItem(k, JSON.stringify(v));
  },
  async removeMany(keys) {
    for (const k of keys) await Storage.removeItem(k);
  },
  async requestPersistence() {
    return true;
  },
};
