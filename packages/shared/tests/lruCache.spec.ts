import { LRUCache } from '../lib/lruCache';

describe('LRUCache', () => {
    let cache: LRUCache<string, number>;

    beforeEach(() => {
        cache = new LRUCache<string, number>(2); // 使用容量为2的缓存进行测试
    });

    it('should store and retrieve values', () => {
        cache.put('a', 1);
        expect(cache.get('a')).toBe(1);
    });

    it('should return undefined for non-existent keys', () => {
        expect(cache.get('nonexistent')).toBeUndefined();
    });

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

    it('should update existing keys', () => {
        cache.put('a', 1);
        cache.put('a', 2);

        expect(cache.get('a')).toBe(2);
    });
});
