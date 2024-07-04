import path from 'path';

// eslint-disable-next-line no-restricted-syntax
import ts from 'typescript';

import { PluginContext, PluginLogger } from '../src/type';

export function createTestProgram(sourceFiles: Record<string, string>, options?: ts.CompilerOptions) {
    const compilerOptions = Object.assign({ target: ts.ScriptTarget.ES2015 }, options);
    const host = ts.createCompilerHost(compilerOptions);

    /**
     * override methods:
     */
    const getSourceFile = host.getSourceFile.bind(host);
    const fileExists = host.fileExists.bind(host);
    const readFile = host.readFile.bind(host);
    host.getSourceFile = (...args) => {
        const [fileName] = args;
        const sourceText = sourceFiles[fileName];
        return sourceText !== undefined ? ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022) : getSourceFile(...args);
    };
    host.fileExists = (fileName) => {
        const sourceText = sourceFiles[fileName];
        return !!sourceText || fileExists(fileName);
    };
    host.readFile = (fileName) => {
        const sourceText = sourceFiles[fileName];
        return sourceText ?? readFile(fileName);
    };
    host.getDefaultLibLocation = () => path.relative(__dirname, '../node_modules/typescript/lib/');

    return ts.createProgram(Object.keys(sourceFiles), compilerOptions, host);
}

export function prepareTestContext(sourceCode: string): PluginContext {
    const sourceFileName = 'test.ts';
    const sourceFiles: Record<string, string> = { [sourceFileName]: sourceCode };
    const program = createTestProgram(sourceFiles);
    const typeChecker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(sourceFileName)!;

    return {
        program,
        typeChecker,
        ts,
        sourceFile,
        logger: createDumbLogger(),
    };
}

function createDumbLogger(): PluginLogger {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noop = (() => {}) as (...args: any[]) => any;
    const coreLogger = {
        startGroup: noop,
        endGroup: noop,
        info: noop,
        error: noop,
    };
    return { ...coreLogger, prefix: () => coreLogger };
}
