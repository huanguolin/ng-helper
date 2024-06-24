import type ts from "typescript";

export type PluginContext = {
    program: ts.Program;
    typeChecker: ts.TypeChecker;
    ts: typeof import("typescript/lib/tsserverlibrary")
    sourceFile: ts.SourceFile;
    logger: ts.server.Logger;
};

