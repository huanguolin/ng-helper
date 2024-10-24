const countMap = new Map<string, number>();

export function timeCost<T>(fnName: string, cb: () => T, threshold: number = 20): T | undefined {
    const cnt = storeAndGetCount(fnName);
    const start = Date.now();
    try {
        return cb();
    } catch (error) {
        console.error(`${fnName}()#${cnt} error:`, error);
    } finally {
        const cost = Date.now() - start;
        if (cost >= threshold) {
            console.warn(`${fnName}()#${cnt} cost ${cost}ms`);
        }
    }
}

function storeAndGetCount(label: string): number {
    if (countMap.has(label)) {
        countMap.set(label, countMap.get(label)! + 1);
    } else {
        countMap.set(label, 1);
    }
    return countMap.get(label)!;
}
