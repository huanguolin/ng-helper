import ts from "typescript";
import { SourceFileTypescriptContext } from "./type";

export function getComponentCompletions(ctx: SourceFileTypescriptContext, fileName: string): string[] | undefined {
    const sourceFile = ctx.program.getSourceFile(fileName);
    if (!sourceFile) {
        return undefined;
    }

    // TODO

    return ['a', 'b', 'c'];
}