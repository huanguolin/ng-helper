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