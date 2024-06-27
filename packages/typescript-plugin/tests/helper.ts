import ts from "typescript";

export function createTsTestProgram(sourceFiles: Record<string, string>) {
    const compilerHost: ts.CompilerHost = {
        getSourceFile: (fileName, languageVersion) => {
            const sourceText = sourceFiles[fileName];
            return sourceText !== undefined
                ? ts.createSourceFile(fileName, sourceText, languageVersion)
                : undefined;
        },
        getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
        writeFile: (fileName, content) => console.log(`Writing ${fileName}: ${content}`),
        getCurrentDirectory: () => "",
        getDirectories: () => [],
        fileExists: fileName => sourceFiles[fileName] !== undefined,
        readFile: fileName => sourceFiles[fileName],
        getCanonicalFileName: fileName => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n"
    };
    return ts.createProgram(Object.keys(sourceFiles), {}, compilerHost);
}

export function prepareSimpleTestData(sourceCode: string, className: string) {
    const sourceFileName = "test.ts";
    const sourceFiles: Record<string, string> = { [sourceFileName]: sourceCode };
    const program = createTsTestProgram(sourceFiles);

    const sourceFile = program.getSourceFile(sourceFileName)!;
    let myClassNode: ts.ClassDeclaration | undefined;
    ts.forEachChild(sourceFile, node => {
        if (ts.isClassDeclaration(node) && node.name && node.name.text === className) {
            myClassNode = node;
        }
    });

    const typeChecker = program.getTypeChecker();
    const type = typeChecker.getTypeAtLocation(myClassNode!);
    return { program, sourceFile, typeChecker, type };
}
