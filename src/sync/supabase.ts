/** Supabase client + the Remote adapter used by the sync engine. The key is the public (publishable) one. */
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { PulledRow, PushItem, PushResult, Remote } from '@/core/sync/engine';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const syncConfigured = !!URL && !!KEY;

/** Native has no localStorage: keep the session in the app's key-value store. */
function nativeStorage() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const kv = require('expo-sqlite/kv-store').default as {
    getItem(k: string): Promise<string | null>;
    setItem(k: string, v: string): Promise<void>;
    removeItem(k: string): Promise<void>;
  };
  return kv;
}

export const supabase = syncConfigured
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        ...(Platform.OS === 'web' ? {} : { storage: nativeStorage() }),
      },
    })
  : null;

export const remote: Remote = {
  async push(items: PushItem[]): Promise<PushResult> {
    const { data, error } = await supabase!.rpc('push_records', { items });
    if (error) throw new Error(error.message);
    return data as PushResult;
  },
  async pull(afterSeq: number, limit: number): Promise<PulledRow[]> {
    const { data, error } = await supabase!
      .from('records')
      .select('kind,id,rev,server_seq,data')
      .gt('server_seq', afterSeq)
      .order('server_seq', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as PulledRow[];
  },
};
