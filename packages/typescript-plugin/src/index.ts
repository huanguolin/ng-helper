import * as http from 'http';

import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { getTsInjectionDiagnostic } from './diagnostic';
import { initHttpServer } from './httpServer';
import { PluginContext, PluginCoreLogger, PluginLogger } from './type';
import { buildLogger } from './utils/log';
import { isComponentTsFile, isControllerTsFile, isServiceTsFile } from './utils/ng';

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

            // Set up decorator object
            const proxy: ts.LanguageService = buildProxy(info);

            overrideGetSemanticDiagnostics({ proxy, info, getContext });

            // dispose
            proxy.dispose = () => {
                server?.close();
                info.languageService.dispose();
                initLogger.info('dispose');
            };

            initLogger.info('end');
            initLogger.endGroup();

            return proxy;
        },
        onConfigurationChanged(config: Partial<NgPluginConfiguration>) {
            if (config.port && start) {
                start(config.port);
            }
        },
    };
}

export = init;

function overrideGetSemanticDiagnostics({
    proxy,
    info,
    getContext,
}: {
    proxy: ts.LanguageService;
    info: ts.server.PluginCreateInfo;
    getContext: (fileName: string) => PluginContext | undefined;
}) {
    proxy.getSemanticDiagnostics = (fileName: string) => {
        const prior = info.languageService.getSemanticDiagnostics(fileName);

        if (!isComponentTsFile(fileName) && !isControllerTsFile(fileName) && !isServiceTsFile(fileName)) {
            return prior;
        }

        const ctx = getContext(fileName);
        if (!ctx) {
            return prior;
        }

        try {
            const diagnostic = getTsInjectionDiagnostic(ctx);
            ctx.logger.info('getSemanticDiagnostics():', diagnostic);
            if (diagnostic) {
                prior.push(diagnostic);
            }
        } catch (error) {
            ctx.logger.error('getSemanticDiagnostics():', (error as Error).message, (error as Error).stack);
        }

        return prior;
    };
}

function buildProxy(info: ts.server.PluginCreateInfo) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const proxy: ts.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
        const x = info.languageService[k]!;
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        // eslint-disable-next-line @typescript-eslint/ban-types
        proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
    }
    return proxy;
}

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
