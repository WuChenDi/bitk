const store = new Map<string, unknown>()
const expiryMap = new Map<string, number>()

export async function cacheGet<T>(key: string): Promise<T | null> {
  const expiry = expiryMap.get(key)
  if (expiry !== undefined && Date.now() >= expiry) {
    store.delete(key)
    expiryMap.delete(key)
    return null
  }
  const value = store.get(key) as T | undefined
  return value ?? null
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
  store.set(key, value)
  if (ttlSeconds !== undefined) {
    expiryMap.set(key, Date.now() + ttlSeconds * 1000)
  } else {
    expiryMap.delete(key)
  }
}

export async function cacheDel(key: string): Promise<void> {
  store.delete(key)
  expiryMap.delete(key)
}
