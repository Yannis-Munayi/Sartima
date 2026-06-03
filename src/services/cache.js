export function createBoundedCache(max = 150) {
  const map = new Map()
  return {
    has: (key) => map.has(key),
    get: (key) => map.get(key),
    set: (key, value) => {
      map.set(key, value)
      if (map.size > max) map.delete(map.keys().next().value)
    },
  }
}
