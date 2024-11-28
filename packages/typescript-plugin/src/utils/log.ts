import type ts from 'typescript';

import { PluginCoreLogger, PluginLogger } from '../type';

const LOG_PREFIX = '[@ng-helper]';

export function buildLogger(
    ts: typeof import('typescript/lib/tsserverlibrary'),
    info: ts.server.PluginCreateInfo,
): PluginLogger {
    const originLogger = info.project.projectService.logger;

    return { ...buildCoreLogger(), prefix: (p: string) => buildCoreLogger(p) };

    function buildCoreLogger(prefix?: string): PluginCoreLogger {
        return {
            info: (msg, ...args) => {
                if (prefix) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    originLogger.info(buildLogMsg(prefix, msg, ...args));
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    originLogger.info(buildLogMsg(msg, ...args));
                }
            },
            error: (msg, ...args) => {
                if (prefix) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    originLogger.msg(buildLogMsg(prefix, msg, ...args), ts.server.Msg.Err);
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    originLogger.msg(buildLogMsg(msg, ...args), ts.server.Msg.Err);
                }
            },
            startGroup: () => originLogger.startGroup(),
            endGroup: () => originLogger.endGroup(),
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function buildLogMsg(msg: string, ...args: any[]): string {
        const arr: string[] = [LOG_PREFIX, msg];
        for (const item of args) {
            if (typeof item === 'string') {
                arr.push(item);
            } else if (item && typeof item === 'object') {
                try {
                    arr.push(JSON.stringify(item));
                } catch {
                    arr.push(`${item}`);
                }
            } else {
                arr.push(`${item}`);
            }
        }
        return arr.join(' ');
    }
}
