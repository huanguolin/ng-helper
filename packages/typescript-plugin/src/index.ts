import * as http from 'http';

import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { initHttpServer } from './httpServer';
import { PluginContext, PluginCoreLogger, PluginLogger } from './type';
import { buildLogger } from './utils/log';

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    let server: http.Server | undefined;
    let start: ((port: number) => void) | undefined;

    return {
        create(info: ts.server.PluginCreateInfo) {
            const logger = buildLogger(modules.typescript, info);
            const initLogger = logger.prefix('[init]');

            initLogger.startGroup();
            initLogger.info('start');

            const getContext = buildGetContextFunc({
                info,
                logger,
                modules,
            });

            ({ start, server } = initHttpServerForPlugin({ getContext, start, server, initLogger, info }));

            initLogger.info('end');
            initLogger.endGroup();

            return info.languageService;
        },
        onConfigurationChanged(config: Partial<NgPluginConfiguration>) {
            if (config.port && start) {
                start(config.port);
            }
        },
    };
}

export = init;

function buildGetContextFunc({
    info,
    logger,
    modules,
}: {
    info: ts.server.PluginCreateInfo;
    logger: PluginLogger;
    modules: {
        typescript: typeof import('typescript/lib/tsserverlibrary');
    };
}): (fileName: string) => PluginContext | undefined {
    return getContext;

    function getContext(fileName: string): PluginContext | undefined {
        const program = info.project['program'] as ts.Program | undefined;

        if (!program) {
            logger.info('getContext()', 'get program failed');
            return undefined;
        }

        const typeChecker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(fileName);

        if (!sourceFile) {
            logger.info('getContext()', 'get source file failed');
            return undefined;
        }

        return {
            program,
            typeChecker,
            sourceFile,
            ts: modules.typescript,
            logger,
        };
    }
}

function initHttpServerForPlugin({
    getContext,
    start,
    server,
    initLogger,
    info,
}: {
    getContext: (fileName: string) => PluginContext | undefined;
    start: ((port: number) => void) | undefined;
    server: http.Server | undefined;
    initLogger: PluginCoreLogger;
    info: ts.server.PluginCreateInfo;
}) {
    const app = initHttpServer(getContext);

    start = (port) => {
        server?.close();
        server = app.listen(port, () => {
            initLogger.info('listening on port', port);
        });
    };

    const config = info.config as Partial<NgPluginConfiguration> | undefined;

    if (config?.port) {
        start(config.port);
    }
    return { start, server };
}
