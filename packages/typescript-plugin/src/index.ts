import * as http from 'http';

import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { initHttpServer } from './httpServer';
import { PluginContext } from './type';
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

            initLogger.info('end');
            initLogger.endGroup();

            return info.languageService;

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
        },
        onConfigurationChanged(config: Partial<NgPluginConfiguration>) {
            if (config.port && start) {
                start(config.port);
            }
        },
    };
}

export = init;
