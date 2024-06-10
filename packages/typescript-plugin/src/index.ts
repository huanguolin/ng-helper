import ts, { CompletionInfoFlags } from "typescript";
import { isNgHelperTsPluginCmd } from "./utils";
import { Cmd, SourceFileTypescriptContext } from "./type";

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

        // Remove specified entries from completion list
        proxy.getCompletionsAtPosition = (fileName, position, options) => {
            const prior = info.languageService.getCompletionsAtPosition(fileName, position, options);
            if (!isNgHelperTsPluginCmd(options)) {
                return prior;
            }

            const ctx = getContext(fileName);
            if (!ctx) {
                return;
            }

            const cmd = options as unknown as Cmd;

            const sourceFile = ctx.program.getSourceFile(fileName);
            if (!sourceFile) return undefined;

            const startPos = sourceFile.getPositionOfLineAndCharacter(
                cmd.range.start.line,
                cmd.range.start.character
            );

            (prior as ts.WithMetadata<ts.CompletionInfo> & { __info: {
                startPos: number;
            }}).__info = {
                startPos,
            };
            return prior;
        };

        return proxy;
    }

    return { create };
}

export = init;
