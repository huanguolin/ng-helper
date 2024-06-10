import ts from "typescript"

export type TypescriptContext = {
    program: ts.Program
    typeChecker: ts.TypeChecker
    ts: typeof import("typescript/lib/tsserverlibrary")
}

export type SourceFileTypescriptContext = TypescriptContext & {
    sourceFile: ts.SourceFile
}

export type Cmd = {
    id: string;
    cmdType: "component";
    range: {
        start: Position;
        end: Position;
    };
}

export type Position = {
    line: number;
    character: number;
}