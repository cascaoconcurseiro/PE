/**
 * LRU (Least Recently Used) Cache Implementation
 * 
 * A cache that automatically removes the least recently used items
 * when the maximum size is reached.
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;

  constructor(maxSize: number = 20) {
    if (maxSize <= 0) {
      throw new Error('LRUCache maxSize must be greater than 0');
    }
    this.maxSize = maxSize;
    this.cache = new Map<K, V>();
  }

  /**
   * Get a value from the cache
   * Moves the accessed item to the end (most recently used)
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value in the cache
   * If cache is full, removes the least recently used item
   */
  set(key: K, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // If cache is full, remove the least recently used (first item)
    if (this.cache.size >= this.maxSize) {
      const iteratorResult = this.cache.keys().next();
      if (!iteratorResult.done) {
        this.cache.delete(iteratorResult.value);
      }
    }

    // Add new item at the end (most recently used)
    this.cache.set(key, value);
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache (for testing/debugging)
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }
}