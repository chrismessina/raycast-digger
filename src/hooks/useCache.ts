import { LocalStorage } from "@raycast/api";
import { CacheEntry, DiggerResult } from "../types";
import { CACHE } from "../utils/config";
import { getCacheKey } from "../utils/urlUtils";

interface CacheIndex {
  keys: string[];
  lastAccessed: Record<string, number>;
}

async function getCacheIndex(): Promise<CacheIndex> {
  const indexStr = await LocalStorage.getItem<string>(CACHE.INDEX_KEY);
  if (!indexStr) {
    return { keys: [], lastAccessed: {} };
  }
  const index: CacheIndex = JSON.parse(indexStr);

  // Drop entries written under an older key version. The index itself is NOT
  // versioned, so bumping the payload prefix alone would leave the old keys
  // listed here forever: never read (every lookup now builds a v2 key), never
  // expired (the 48h check only runs on a read), and still counting toward
  // MAX_ENTRIES — so a full index would evict live entries to make room for
  // dead ones. Purge them once, on the first read after an upgrade.
  const stale = index.keys.filter((k) => !k.startsWith(CACHE.KEY_PREFIX));
  if (stale.length === 0) return index;

  await Promise.all(stale.map((k) => LocalStorage.removeItem(k)));
  index.keys = index.keys.filter((k) => k.startsWith(CACHE.KEY_PREFIX));
  for (const k of stale) delete index.lastAccessed[k];
  await saveCacheIndex(index);
  return index;
}

async function saveCacheIndex(index: CacheIndex): Promise<void> {
  await LocalStorage.setItem(CACHE.INDEX_KEY, JSON.stringify(index));
}

async function evictLRU(): Promise<void> {
  const index = await getCacheIndex();

  if (index.keys.length >= CACHE.MAX_ENTRIES) {
    const sortedKeys = index.keys.sort((a, b) => {
      const aAccessed = index.lastAccessed[a] || 0;
      const bAccessed = index.lastAccessed[b] || 0;
      return aAccessed - bAccessed;
    });

    const toRemove = sortedKeys[0];
    await LocalStorage.removeItem(toRemove);

    index.keys = index.keys.filter((k) => k !== toRemove);
    delete index.lastAccessed[toRemove];

    await saveCacheIndex(index);
  }
}

export function useCache() {
  const getFromCache = async (url: string): Promise<DiggerResult | null> => {
    const cacheKey = getCacheKey(url);
    const cached = await LocalStorage.getItem<string>(cacheKey);

    if (!cached) {
      return null;
    }

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();

    if (now - entry.timestamp > CACHE.DURATION_MS) {
      await LocalStorage.removeItem(cacheKey);
      return null;
    }

    entry.lastAccessed = now;
    await LocalStorage.setItem(cacheKey, JSON.stringify(entry));

    const index = await getCacheIndex();
    index.lastAccessed[cacheKey] = now;
    await saveCacheIndex(index);

    return entry.data;
  };

  /**
   * @param isCancelled Optional predicate re-checked after eviction, immediately
   *   before the write. `evictLRU` is a suspension point long enough for a newer
   *   fetch to start, abort this one, and persist its own entry first — after
   *   which this call would resume and overwrite that newer entry under the same
   *   key. Checking only before calling `saveToCache` cannot see that, because
   *   the supersession happens after the call has already begun.
   */
  const saveToCache = async (url: string, data: DiggerResult, isCancelled?: () => boolean): Promise<void> => {
    await evictLRU();
    if (isCancelled?.()) return;

    const cacheKey = getCacheKey(url);
    const now = Date.now();

    const entry: CacheEntry = {
      url,
      data,
      timestamp: now,
      lastAccessed: now,
    };

    await LocalStorage.setItem(cacheKey, JSON.stringify(entry));

    const index = await getCacheIndex();
    if (!index.keys.includes(cacheKey)) {
      index.keys.push(cacheKey);
    }
    index.lastAccessed[cacheKey] = now;
    await saveCacheIndex(index);
  };

  const clearCache = async (): Promise<void> => {
    const index = await getCacheIndex();

    for (const key of index.keys) {
      await LocalStorage.removeItem(key);
    }

    await LocalStorage.removeItem(CACHE.INDEX_KEY);
  };

  const refreshEntry = async (url: string): Promise<void> => {
    const cacheKey = getCacheKey(url);
    await LocalStorage.removeItem(cacheKey);

    const index = await getCacheIndex();
    index.keys = index.keys.filter((k) => k !== cacheKey);
    delete index.lastAccessed[cacheKey];
    await saveCacheIndex(index);
  };

  return {
    getFromCache,
    saveToCache,
    clearCache,
    refreshEntry,
  };
}
