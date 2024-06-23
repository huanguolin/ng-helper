import ts from "typescript";
import { PluginConfiguration } from '@ng-helper/shared/lib/plugin';
import { TypeScriptContextWithSourceFile } from "./type";
import * as http from 'http';
import { initHttpServer } from "./httpServer";

function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {

    let server: http.Server | undefined;
    let start: ((port: number) => void) | undefined;

    return {
        create(info: ts.server.PluginCreateInfo) {
            info.project.projectService.logger.info("===> @ng-helper/typescript-plugin init");

            const app = initHttpServer(getContext);

            start = port => {
                server?.close();
                server = app.listen(port, () => {
                    info.project.projectService.logger.info(`===> @ng-helper/typescript-plugin listening on port ${port}`);
                });
            };

            const config = info.config as
                | Partial<PluginConfiguration>
                | undefined;

            if (config?.port) {
                start(config.port);
            }

            return info.languageService;

            function getContext(
                fileName: string
            ): TypeScriptContextWithSourceFile | undefined {
                const program = info.project["program"] as ts.Program | undefined

                if (!program) return undefined

                const typeChecker = program.getTypeChecker()
                const sourceFile = program.getSourceFile(fileName)

                if (!sourceFile) return undefined

                return {
                    program,
                    typeChecker,
                    sourceFile,
                    ts: modules.typescript,
                }
            }
        },
        onConfigurationChanged(config: Partial<PluginConfiguration>) {
            if (config.port && start) {
                start(config.port);
            }
        }
    };
}

export = init;

