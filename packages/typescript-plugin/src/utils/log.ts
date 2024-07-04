const LOG_PREFIX = '[@ng-helper/typescript-plugin]';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLogMsg(...args: any[]): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const arr = args.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : x));
    arr.unshift(LOG_PREFIX);
    return arr.join(' ');
}
