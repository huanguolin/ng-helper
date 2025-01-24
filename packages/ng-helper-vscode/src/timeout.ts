const countMap = new Map<string, number>();

type TimeoutWithMeasureOptions = {
    /**
     * timeout default is 3000ms
     */
    timeout?: number;
    /**
     * slow threshold default is 50ms, see https://github.com/microsoft/tolerant-php-parser/tree/main?tab=readme-ov-file#:~:text=%3C%20100%20ms%20UI%20response%20time%2C%20so%20each%20language%20server%20operation%20should%20be%20%3C%2050%20ms%20to%20leave%20room%20for%20all%20the%20other%20stuff%20going%20on%20in%20parallel.
     */
    slowThreshold?: number;
    /**
     * if true, only print warn/error message
     */
    silent?: boolean;
};

export async function timeoutWithMeasure<T>(
    label: string,
    cb: () => T | Promise<T>,
    { timeout = 3000, slowThreshold = 50, silent = false }: TimeoutWithMeasureOptions = {},
): Promise<T | undefined> {
    const cnt = storeAndGetCount(label);
    const start = Date.now();
    let hasError = false;

    if (!silent) {
        console.groupCollapsed(`[timeoutWithMeasure] ${label}()#${cnt}`);
    }
    try {
        return await Promise.race([cb(), createTimeoutPromise(timeout)]);
    } catch (error) {
        hasError = true;
        console.error(`${label}()#${cnt} error:`, error);
    } finally {
        if (!hasError) {
            const cost = Date.now() - start;
            if (cost >= slowThreshold) {
                console.warn(`${label}()#${cnt} cost ${cost}ms`);
            }
        }
        if (!silent) {
            console.groupEnd();
        }
    }
}

function createTimeoutPromise(timeout: number): Promise<undefined> {
    return new Promise<undefined>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout(${timeout}ms)`)), timeout);
    });
}

function storeAndGetCount(label: string): number {
    if (countMap.has(label)) {
        countMap.set(label, countMap.get(label)! + 1);
    } else {
        countMap.set(label, 1);
    }
    return countMap.get(label)!;
}
