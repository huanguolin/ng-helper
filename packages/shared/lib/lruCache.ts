export class LRUCache<TKey, TValue> {
    private capacity: number;
    private cache: Map<TKey, TValue>;

    constructor(capacity: number) {
        if (capacity <= 0) {
            throw new Error('Capacity must be greater than 0');
        }
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key: TKey): TValue | undefined {
        if (!this.cache.has(key)) {
            return;
        }

        // 更新 key 的使用顺序：先删除，再重新插入
        // 这样就排到最后了
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    put(key: TKey, value: TValue) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // 如果缓存已满，删除最久未使用的（第一个）
            const oldestKey = this.cache.keys().next().value as TKey;
            this.cache.delete(oldestKey);
        }

        // 插入新的 key-value
        this.cache.set(key, value);
    }

    has(key: TKey): boolean {
        return this.cache.has(key);
    }

    delete(key: TKey): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    get size(): number {
        return this.cache.size;
    }

    keys(): IterableIterator<TKey> {
        return this.cache.keys();
    }

    values(): IterableIterator<TValue> {
        return this.cache.values();
    }
}
