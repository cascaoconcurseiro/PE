import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '../LRUCache';

describe('LRUCache', () => {
  describe('Constructor', () => {
    it('should create cache with default max size of 20', () => {
      const cache = new LRUCache<string, number>();
      expect(cache.size).toBe(0);
    });

    it('should create cache with custom max size', () => {
      const cache = new LRUCache<string, number>(5);
      expect(cache.size).toBe(0);
    });

    it('should throw error if maxSize is 0 or negative', () => {
      expect(() => new LRUCache<string, number>(0)).toThrow('LRUCache maxSize must be greater than 0');
      expect(() => new LRUCache<string, number>(-1)).toThrow('LRUCache maxSize must be greater than 0');
    });
  });

  describe('Cache Hit/Miss', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = new LRUCache<string, number>(3);
    });

    it('should return undefined for cache miss', () => {
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return value for cache hit', () => {
      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);
    });

    it('should update existing key without increasing size', () => {
      cache.set('key1', 100);
      cache.set('key1', 200);
      expect(cache.size).toBe(1);
      expect(cache.get('key1')).toBe(200);
    });

    it('should handle multiple keys', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
      expect(cache.size).toBe(3);
    });
  });

  describe('Size Limit', () => {
    it('should not exceed max size', () => {
      const cache = new LRUCache<string, number>(3);
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      expect(cache.size).toBe(3);
      
      // Adding 4th item should evict the first
      cache.set('key4', 400);
      expect(cache.size).toBe(3);
    });

    it('should maintain size limit with single item cache', () => {
      const cache = new LRUCache<string, number>(1);
      
      cache.set('key1', 100);
      expect(cache.size).toBe(1);
      
      cache.set('key2', 200);
      expect(cache.size).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe(200);
    });
  });

  describe('LRU Eviction Order', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = new LRUCache<string, number>(3);
    });

    it('should evict least recently used item when cache is full', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      // key1 is least recently used
      cache.set('key4', 400);
      
      expect(cache.get('key1')).toBeUndefined(); // Evicted
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should update LRU order on get', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      // Access key1, making it most recently used
      cache.get('key1');
      
      // Now key2 is least recently used
      cache.set('key4', 400);
      
      expect(cache.get('key1')).toBe(100); // Still exists
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should update LRU order on set of existing key', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      // Update key1, making it most recently used
      cache.set('key1', 150);
      
      // Now key2 is least recently used
      cache.set('key4', 400);
      
      expect(cache.get('key1')).toBe(150); // Still exists with new value
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });

    it('should maintain correct order with multiple accesses', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      // Access pattern: key2, key1, key3
      cache.get('key2');
      cache.get('key1');
      cache.get('key3');
      
      // Now order is: key2 (oldest), key1, key3 (newest)
      cache.set('key4', 400);
      
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key3')).toBe(300);
      expect(cache.get('key4')).toBe(400);
    });
  });

  describe('has() method', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
      cache = new LRUCache<string, number>(3);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('key1')).toBe(false);
    });

    it('should return true for existing key', () => {
      cache.set('key1', 100);
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false after eviction', () => {
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      cache.set('key4', 400); // Evicts key1
      
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('clear() method', () => {
    it('should remove all items from cache', () => {
      const cache = new LRUCache<string, number>(3);
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      expect(cache.size).toBe(3);
      
      cache.clear();
      
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should allow adding items after clear', () => {
      const cache = new LRUCache<string, number>(2);
      
      cache.set('key1', 100);
      cache.clear();
      cache.set('key2', 200);
      
      expect(cache.size).toBe(1);
      expect(cache.get('key2')).toBe(200);
    });
  });

  describe('keys() method', () => {
    it('should return all keys in order', () => {
      const cache = new LRUCache<string, number>(3);
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      const keys = cache.keys();
      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should reflect LRU order after access', () => {
      const cache = new LRUCache<string, number>(3);
      
      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);
      
      cache.get('key1'); // Move key1 to end
      
      const keys = cache.keys();
      expect(keys).toEqual(['key2', 'key3', 'key1']);
    });
  });

  describe('Complex scenarios', () => {
    it('should handle mixed operations correctly', () => {
      const cache = new LRUCache<string, string>(3);
      
      cache.set('a', 'alpha');
      cache.set('b', 'beta');
      expect(cache.get('a')).toBe('alpha');
      cache.set('c', 'gamma');
      cache.set('d', 'delta'); // Evicts 'b'
      
      expect(cache.has('b')).toBe(false);
      expect(cache.get('a')).toBe('alpha');
      expect(cache.get('c')).toBe('gamma');
      expect(cache.get('d')).toBe('delta');
    });

    it('should work with different value types', () => {
      const cache = new LRUCache<string, { value: number }>(2);
      
      cache.set('obj1', { value: 100 });
      cache.set('obj2', { value: 200 });
      
      expect(cache.get('obj1')).toEqual({ value: 100 });
      expect(cache.get('obj2')).toEqual({ value: 200 });
    });
  });
});
