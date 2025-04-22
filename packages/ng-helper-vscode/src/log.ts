export function log(level: 'E' | 'I' | 'D', ...rest: unknown[]) {
    // TODO: 级别控制
    const args = [`[${level}] `, ...rest];
    switch (level) {
        case 'D':
            console.debug(...args);
            break;
        case 'I':
            console.info(...args);
            break;
        case 'E':
            console.error(...args);
            break;
        default:
    }
}
