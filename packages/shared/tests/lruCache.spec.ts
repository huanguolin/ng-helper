import { LRUCache } from '../lib/lruCache';

describe('LRUCache', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
        cache = new LRUCache<string, number>(2); // 使用容量为2的缓存进行测试
    });

    describe('Constructor', () => {
        it('should throw error for invalid capacity', () => {
            expect(() => new LRUCache(0)).toThrow('Capacity must be greater than 0');
            expect(() => new LRUCache(-1)).toThrow('Capacity must be greater than 0');
        });

        it('should create cache with valid capacity', () => {
            expect(() => new LRUCache(1)).not.toThrow();
            expect(() => new LRUCache(10)).not.toThrow();
        });
    });

    describe('Basic Operations', () => {
        it('should store and retrieve values', () => {
            cache.put('a', 1);
            expect(cache.get('a')).toBe(1);
        });

        it('should return undefined for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        it('should update existing keys', () => {
            cache.put('a', 1);
            cache.put('a', 2);

            expect(cache.get('a')).toBe(2);
        });
    });

    describe('Capacity Management', () => {
        it('should respect capacity limit', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.put('c', 3); // 这会导致 'a' 被淘汰

            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBe(2);
            expect(cache.get('c')).toBe(3);
        });

        it('should update access order on get', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.get('a'); // 访问 'a'，使其变为最近使用
            cache.put('c', 3); // 这会导致 'b' 被淘汰，而不是 'a'

            expect(cache.get('a')).toBe(1);
            expect(cache.get('b')).toBeUndefined();
            expect(cache.get('c')).toBe(3);
        });

        it('should work with capacity of 1', () => {
            const singleCache = new LRUCache<string, number>(1);
            singleCache.put('a', 1);
            expect(singleCache.get('a')).toBe(1);

            singleCache.put('b', 2);
            expect(singleCache.get('a')).toBeUndefined();
            expect(singleCache.get('b')).toBe(2);
        });
    });

    describe('has() method', () => {
        it('should return true for existing keys', () => {
            cache.put('a', 1);
            expect(cache.has('a')).toBe(true);
        });

        it('should return false for non-existent keys', () => {
            expect(cache.has('nonexistent')).toBe(false);
        });

        it('should not affect access order', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.has('a'); // 不应该影响访问顺序
            cache.put('c', 3); // 应该淘汰 'a'

            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBe(2);
            expect(cache.get('c')).toBe(3);
        });
    });

    describe('delete() method', () => {
        it('should delete existing keys', () => {
            cache.put('a', 1);
            expect(cache.delete('a')).toBe(true);
            expect(cache.get('a')).toBeUndefined();
            expect(cache.has('a')).toBe(false);
        });

        it('should return false for non-existent keys', () => {
            expect(cache.delete('nonexistent')).toBe(false);
        });

        it('should allow adding more items after deletion', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.delete('a');
            cache.put('c', 3); // 应该能成功添加，因为删除了 'a'

            expect(cache.get('b')).toBe(2);
            expect(cache.get('c')).toBe(3);
        });
    });

    describe('clear() method', () => {
        it('should clear all entries', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.clear();

            expect(cache.get('a')).toBeUndefined();
            expect(cache.get('b')).toBeUndefined();
            expect(cache.size).toBe(0);
        });

        it('should work on empty cache', () => {
            expect(() => cache.clear()).not.toThrow();
            expect(cache.size).toBe(0);
        });
    });

    describe('size property', () => {
        it('should return correct size', () => {
            expect(cache.size).toBe(0);

            cache.put('a', 1);
            expect(cache.size).toBe(1);

            cache.put('b', 2);
            expect(cache.size).toBe(2);

            cache.put('c', 3); // 超过容量，size 应该保持为 2
            expect(cache.size).toBe(2);
        });

        it('should update size when deleting', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            expect(cache.size).toBe(2);

            cache.delete('a');
            expect(cache.size).toBe(1);
        });
    });

    describe('Iterator methods', () => {
        beforeEach(() => {
            cache.put('a', 1);
            cache.put('b', 2);
        });

        it('should return correct keys', () => {
            const keys = Array.from(cache.keys());
            expect(keys).toEqual(['a', 'b']);
        });

        it('should return correct values', () => {
            const values = Array.from(cache.values());
            expect(values).toEqual([1, 2]);
        });

        it('should maintain insertion order for keys and values', () => {
            cache.get('a'); // 访问 'a'，应该将其移到最后

            const keys = Array.from(cache.keys());
            const values = Array.from(cache.values());

            expect(keys).toEqual(['b', 'a']);
            expect(values).toEqual([2, 1]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle different data types as keys', () => {
            const objectCache = new LRUCache<object, string>(2);
            const key1 = { id: 1 };
            const key2 = { id: 2 };

            objectCache.put(key1, 'value1');
            objectCache.put(key2, 'value2');

            expect(objectCache.get(key1)).toBe('value1');
            expect(objectCache.get(key2)).toBe('value2');
        });

        it('should handle null and undefined values', () => {
            const mixedCache = new LRUCache<string, number | null | undefined>(2);
            mixedCache.put('null', null);
            mixedCache.put('undefined', undefined);

            expect(mixedCache.get('null')).toBeNull();
            expect(mixedCache.get('undefined')).toBeUndefined();
            expect(mixedCache.has('null')).toBe(true);
            expect(mixedCache.has('undefined')).toBe(true);
        });

        it('should handle updating key that moves it to end', () => {
            cache.put('a', 1);
            cache.put('b', 2);
            cache.put('a', 10); // 更新现有key，应该将其移到最后
            cache.put('c', 3); // 应该淘汰 'b'

            expect(cache.get('a')).toBe(10);
            expect(cache.get('b')).toBeUndefined();
            expect(cache.get('c')).toBe(3);
        });
    });
});
