// eslint-disable-next-line no-restricted-imports
import type ts from 'typescript';

export interface PluginCoreLogger {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info: (msg: string, ...args: any[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: (msg: string, ...args: any[]) => void;
    startGroup(): void;
    endGroup(): void;
}

export interface PluginLogger extends PluginCoreLogger {
    prefix: (prefix: string) => PluginCoreLogger;
}

export type PluginContext = {
    program: ts.Program;
    typeChecker: ts.TypeChecker;
    ts: typeof import('typescript/lib/tsserverlibrary');
    sourceFile: ts.SourceFile;
    logger: PluginLogger;
};

export type SyntaxNodeInfo = {
    sourceFile: ts.SourceFile;
    node: ts.Node;
};

export type ComponentCoreInfo = {
    controllerAs: string;
    controllerType?: ts.Type;
    bindings: Map<string, string>;
};
