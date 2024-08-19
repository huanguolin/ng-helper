const countMap = new Map<string, number>();

export function timeCost<T>(label: string, cb: () => T, threshold: number = 20): T {
    const cnt = storeAndGetCount(label);
    const start = Date.now();
    try {
        return cb();
    } finally {
        const cost = Date.now() - start;
        if (cost >= threshold) {
            console.log(`${label}#${cnt} cost ${cost}ms`);
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
