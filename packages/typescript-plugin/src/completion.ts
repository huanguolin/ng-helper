import ts from "typescript";
import { SourceFileTypescriptContext } from "./type";

export function getComponentCompletions(ctx: SourceFileTypescriptContext): string[] | undefined {
    if (!ctx.sourceFile) {
        return undefined;
    }

    // TODO

    return ['a', 'b', 'c'];
}