import * as http from 'http';

import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { initHttpServer } from './httpServer';
import { PluginContext } from './type';
import { buildLogMsg } from './utils';

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    let server: http.Server | undefined;
    let start: ((port: number) => void) | undefined;

    return {
        create(info: ts.server.PluginCreateInfo) {
            const logger = info.project.projectService.logger;
            logger.info(buildLogMsg('init'));

            const app = initHttpServer(getContext);

            start = (port) => {
                server?.close();
                server = app.listen(port, () => {
                    logger.info(buildLogMsg('listening on port', port));
                });
            };

            const config = info.config as Partial<NgPluginConfiguration> | undefined;

            if (config?.port) {
                start(config.port);
            }

            return info.languageService;

            function getContext(fileName: string): PluginContext | undefined {
                const program = info.project['program'] as ts.Program | undefined;

                if (!program) {
                    return undefined;
                }

                const typeChecker = program.getTypeChecker();
                const sourceFile = program.getSourceFile(fileName);

                if (!sourceFile) {
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
        // TODO
        // onabort() {
        //     server?.close();
        // },
        onConfigurationChanged(config: Partial<NgPluginConfiguration>) {
            if (config.port && start) {
                start(config.port);
            }
        },
    };
}

export = init;
