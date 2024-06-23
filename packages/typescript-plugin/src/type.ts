import ts from "typescript"

export type TypeScriptContext = {
    program: ts.Program
    typeChecker: ts.TypeChecker
    ts: typeof import("typescript/lib/tsserverlibrary")
}

export type TypeScriptContextWithSourceFile = TypeScriptContext & {
    sourceFile: ts.SourceFile
}
