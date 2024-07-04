import ts from 'typescript';

import { PluginContext } from '../src/type';

export function createTsTestProgram(sourceFiles: Record<string, string>, options?: ts.CompilerOptions) {
    const compilerOptions = Object.assign({ target: ts.ScriptTarget.ES5 }, options);
    const host = ts.createCompilerHost(compilerOptions);

    // override methods:
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { getSourceFile, fileExists, readFile } = host;
    host.getSourceFile = (...args) => {
        const [fileName, languageVersion] = args;
        const sourceText = sourceFiles[fileName];
        return sourceText !== undefined ? ts.createSourceFile(fileName, sourceText, languageVersion) : getSourceFile(...args);
    };
    host.fileExists = (fileName) => {
        const sourceText = sourceFiles[fileName];
        return !!sourceText || fileExists(fileName);
    };
    host.readFile = (fileName) => {
        const sourceText = sourceFiles[fileName];
        return sourceText ?? readFile(fileName);
    };
    host.getDefaultLibLocation = () => './node_modules/typescript/lib/';

    return ts.createProgram(Object.keys(sourceFiles), compilerOptions, host);
}

export function prepareSimpleTestData(sourceCode: string, className: string) {
    const sourceFileName = 'test.ts';
    const sourceFiles: Record<string, string> = { [sourceFileName]: sourceCode };
    const program = createTsTestProgram(sourceFiles);

    const sourceFile = program.getSourceFile(sourceFileName)!;
    let myClassNode: ts.ClassDeclaration | undefined;
    ts.forEachChild(sourceFile, (node) => {
        if (ts.isClassDeclaration(node) && node.name && node.name.text === className) {
            myClassNode = node;
        }
    });

    const typeChecker = program.getTypeChecker();
    const type = typeChecker.getTypeAtLocation(myClassNode!);

    const ctx: PluginContext = {
        program,
        typeChecker,
        ts,
        sourceFile,
        logger: createDumbLogger(),
    };
    return { program, sourceFile, typeChecker, type, ctx };
}

function createDumbLogger(): ts.server.Logger {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noop = (() => {}) as (...args: any[]) => any;
    return {
        close: noop,
        hasLevel: noop,
        loggingEnabled: () => true,
        perftrc: noop,
        info: noop,
        startGroup: noop,
        endGroup: noop,
        msg: noop,
        getLogFileName: noop,
    };
}
