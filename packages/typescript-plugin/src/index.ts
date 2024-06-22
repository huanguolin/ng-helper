import ts, { CompletionInfoFlags } from "typescript";
import { isNgHelperTsPluginCmd } from "./utils";
import { Cmd, NgHelperResponse, SourceFileTypescriptContext } from "./type";
import { getComponentCompletions } from "./completion";

function init(modules: { typescript: typeof import("typescript/lib/tsserverlibrary") }) {

    function create(info: ts.server.PluginCreateInfo) {

        // Set up decorator object
        const proxy: ts.LanguageService = Object.create(null);
        for (let k of Object.keys(info.languageService) as Array<keyof ts.LanguageService>) {
            const x = info.languageService[k]!;
            // @ts-expect-error - JS runtime trickery which is tricky to type tersely
            proxy[k] = (...args: Array<{}>) => x.apply(info.languageService, args);
        }

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

        info.project.projectService.logger.info("===> @ng-helper/typescript-plugin init");

        // Remove specified entries from completion list
        proxy.getCompletionsAtPosition = (fileName, position, options, formattingSettings) => {
            info.project.projectService.logger.info(
                `===> @ng-helper/typescript-plugin completion: ${fileName}, position: ${JSON.stringify(position)}, options: ${JSON.stringify(options)}`
            );

            if (!isNgHelperTsPluginCmd(options)) {
                return info.languageService.getCompletionsAtPosition(fileName, position, options, formattingSettings);
            }

            const ctx = getContext(fileName);
            if (!ctx) {
                return undefined;
            }

            const prior: NgHelperResponse = {
                isGlobalCompletion: false,
                isMemberCompletion: false,
                isNewIdentifierLocation: false,
                entries: [],
            };

            try {
                const response = getComponentCompletions(ctx, fileName);
                if (response) {
                    prior.__ngHelperCompletions = {
                        type: 'data',
                        data: response,
                    };
                }
            } catch (error) {
                prior.__ngHelperCompletions = {
                    type: 'error',
                    error,
                };
            }

            return prior;
        };

        return proxy;
    }

    return { create };
}

export = init;
