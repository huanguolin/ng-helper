import ts, { CompletionInfoFlags } from "typescript";
import { isNgHelperTsPluginCmd } from "./utils";
import { PluginConfiguration } from '@ng-helper/shared/lib/plugin';
import { SourceFileTypescriptContext } from "./type";
import { getComponentCompletions } from "./completion";
import express from 'express';
import * as http from 'http';

function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {

    let server: http.Server | undefined;
    let start: ((port: number) => void) | undefined;

    return {
        create(info: ts.server.PluginCreateInfo) {
            info.project.projectService.logger.info("===> @ng-helper/typescript-plugin init");

            const app = express();
            app.use(express.json());

            app.post('/ng-helper/command', (req, res) => {
                const body = req.body as { fileName: string };
                try {
                    const ctx = getContext(body.fileName);
                    if (!ctx) {
                        return res.send();
                    }
                    const response = getComponentCompletions(ctx);
                    res.send(response);
                } catch {
                    res.status(500).send({});
                }
            });

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
            ): SourceFileTypescriptContext | undefined {
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
