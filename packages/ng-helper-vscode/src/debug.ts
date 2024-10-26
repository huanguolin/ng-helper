const countMap = new Map<string, number>();

export async function timeCost<T>(fnName: string, cb: () => T | Promise<T>, threshold: number = 80): Promise<T | undefined> {
    const cnt = storeAndGetCount(fnName);
    const start = Date.now();
    console.group(`[timeCost] ${fnName}()#${cnt}`);
    try {
        return await cb();
    } catch (error) {
        console.error(`${fnName}()#${cnt} error:`, error);
    } finally {
        const cost = Date.now() - start;
        if (cost >= threshold) {
            console.warn(`${fnName}()#${cnt} cost ${cost}ms`);
        }
        console.groupEnd();
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
