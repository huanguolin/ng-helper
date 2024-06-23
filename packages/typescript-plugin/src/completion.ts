import ts from "typescript";
import { TypeScriptContextWithSourceFile } from "./type";

export function getComponentCompletions(ctx: TypeScriptContextWithSourceFile): string[] | undefined {
    if (!ctx.sourceFile) {
        return undefined;
    }

    // TODO

    return ['a', 'b', 'c'];
}