const countMap = new Map<string, number>();

// threshold default is 50ms, see https://github.com/microsoft/tolerant-php-parser/tree/main?tab=readme-ov-file#:~:text=%3C%20100%20ms%20UI%20response%20time%2C%20so%20each%20language%20server%20operation%20should%20be%20%3C%2050%20ms%20to%20leave%20room%20for%20all%20the%20other%20stuff%20going%20on%20in%20parallel.
export async function timeCost<T>(
    fnName: string,
    cb: () => T | Promise<T>,
    threshold: number = 50,
): Promise<T | undefined> {
    const cnt = storeAndGetCount(fnName);
    const start = Date.now();
    console.log('>>>>> ' + fnName);
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
        console.log('<<<<< ' + fnName);
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
