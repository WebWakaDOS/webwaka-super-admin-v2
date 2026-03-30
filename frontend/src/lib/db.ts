import Dexie, { Table } from 'dexie';

// Define database schema
export interface CachedData {
  id?: number;
  key: string;
  value: unknown;
  timestamp: number;
  expiresAt?: number;
}

export interface PendingMutation {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface OfflineEvent {
  id?: number;
  type: string;
  data: unknown;
  timestamp: number;
  synced: boolean;
}

export class WebWakaDB extends Dexie {
  cachedData!: Table<CachedData>;
  pendingMutations!: Table<PendingMutation>;
  offlineEvents!: Table<OfflineEvent>;

  constructor() {
    super('webwaka-admin-db');
    this.version(1).stores({
      cachedData: '++id, key, timestamp',
      pendingMutations: '++id, timestamp, url',
      offlineEvents: '++id, timestamp, type, synced',
    });
  }
}

export const db = new WebWakaDB();

// Cache management functions
export async function setCacheData(key: string, value: unknown, ttlSeconds?: number) {
  const now = Date.now();
  const expiresAt = ttlSeconds ? now + ttlSeconds * 1000 : undefined;

  await db.cachedData.put({
    key,
    value,
    timestamp: now,
    expiresAt,
  });
}

export async function getCacheData(key: string): Promise<unknown | undefined> {
  const now = Date.now();
  const cached = await db.cachedData.where('key').equals(key).first();

  if (!cached) return undefined;

  // Check if expired
  if (cached.expiresAt && cached.expiresAt < now) {
    await db.cachedData.delete(cached.id!);
    return undefined;
  }

  return cached.value;
}

export async function clearExpiredCache() {
  const now = Date.now();
  await db.cachedData.where('expiresAt').below(now).delete();
}

export async function clearAllCache() {
  await db.cachedData.clear();
}

export async function deleteCacheData(key: string) {
  const cached = await db.cachedData.where('key').equals(key).first();
  if (cached?.id !== undefined) {
    await db.cachedData.delete(cached.id);
  }
}

// Pending mutation management
export async function addPendingMutation(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: string
) {
  const now = Date.now();
  await db.pendingMutations.add({
    url,
    method,
    headers,
    body,
    timestamp: now,
    retries: 0,
    maxRetries: 3,
  });
}

export async function getPendingMutations() {
  return await db.pendingMutations.toArray();
}

export async function removePendingMutation(id: number) {
  await db.pendingMutations.delete(id);
}

export async function incrementMutationRetry(id: number) {
  const mutation = await db.pendingMutations.get(id);
  if (mutation) {
    await db.pendingMutations.update(id, {
      retries: mutation.retries + 1,
    });
  }
}

// Offline event logging
export async function logOfflineEvent(type: string, data: unknown) {
  const now = Date.now();
  await db.offlineEvents.add({
    type,
    data,
    timestamp: now,
    synced: false,
  });
}

export async function getUnsyncedEvents() {
  return await db.offlineEvents.toArray().then(events => events.filter(e => !e.synced));
}

export async function markEventAsSynced(id: number) {
  await db.offlineEvents.update(id, { synced: true });
}

export async function clearSyncedEvents() {
  const events = await db.offlineEvents.toArray();
  const syncedIds = events.filter(e => e.synced).map(e => e.id!);
  await db.offlineEvents.bulkDelete(syncedIds);
}

// Batch operations
export async function clearDatabase() {
  await db.cachedData.clear();
  await db.pendingMutations.clear();
  await db.offlineEvents.clear();
}
