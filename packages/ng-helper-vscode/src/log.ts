export type LogLevel = 'E' | 'I' | 'D'; // E: error, I: info, D: debug

const levelWeightMap: Record<LogLevel, number> = {
    E: 3,
    I: 2,
    D: 1,
};

const minLevel = 'I';

export function log(level: 'E' | 'I' | 'D', ...rest: unknown[]) {
    if (levelWeightMap[level] < levelWeightMap[minLevel]) {
        return;
    }

    const args = [`[${level}]`, ...rest];
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
