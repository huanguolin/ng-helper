export type LogLevel = 'E' | 'W' | 'I' | 'D'; // E: error, W: warning, I: info, D: debug

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function logFilter(level: LogLevel, prefix: string[], logContent: unknown[]): boolean {
    // 在这里可以实现日志过滤逻辑
    if (level === 'D') {
        // 排除 debug 级别的日志
        return false;
    }
    return true;
}

class Logger {
    constructor(private readonly prefix: string[] = []) {}

    prefixWith(...prefix: string[]): Logger {
        return new Logger([...this.prefix, ...prefix]);
    }

    logError(...logContent: unknown[]): void {
        this.log('E', ...logContent);
    }

    logWarning(...logContent: unknown[]): void {
        this.log('W', ...logContent);
    }

    logInfo(...logContent: unknown[]): void {
        this.log('I', ...logContent);
    }

    logDebug(...logContent: unknown[]): void {
        this.log('D', ...logContent);
    }

    private log(level: LogLevel, ...logContent: unknown[]): void {
        if (!logFilter(level, this.prefix, logContent)) {
            return;
        }
        // 取时间 2025-06-07T10:44:04.248Z => 10:44:04.248
        const time = new Date().toISOString().slice(11, -1);

        const prefixString = this.prefix.length > 0 ? `[${this.prefix.join(' ')}]` : '';

        // 输出格式: E 10:44:04.248 [RpcProcess RpcServer] ...logContent
        const logs = [`[${level}]`, time, prefixString, ...logContent];
        console.log(...logs);
    }
}

export const logger = new Logger();
