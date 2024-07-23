const countMap = new Map<string, number>();

export function timeCost<T>(label: string, cb: () => T): T {
    const cnt = storeAndGetCount(label);
    const newLabel = `${label}#${cnt}`;
    console.time(newLabel);
    try {
        return cb();
    } finally {
        console.timeEnd(newLabel);
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
