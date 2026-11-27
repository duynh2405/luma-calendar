export interface RecordStorage {
  loadAll(): Promise<Record<string, unknown>>;
  putMany(entries: [string, unknown][]): Promise<void>;
  removeMany(keys: string[]): Promise<void>;
  /** Ask the platform to keep data (web: navigator.storage.persist). */
  requestPersistence(): Promise<boolean>;
}

/** Storage keys. Bump SCHEMA_VERSION and add a migration in store.ts when the shape changes. */
export const SCHEMA_VERSION = 2;
export const KEY = {
  meta: 'meta',
  settings: 'settings',
  calendar: (id: string) => `cal:${id}`,
  event: (id: string) => `evt:${id}`,
  task: (id: string) => `task:${id}`,
} as const;
