import { NgPluginConfiguration, type NgComponentDirectiveNamesInfo } from '@ng-helper/shared/lib/plugin';
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

export interface CorePluginContext {
    program: ts.Program;
    typeChecker: ts.TypeChecker;
    ts: typeof import('typescript/lib/tsserverlibrary');
    logger: PluginLogger;
}

export interface PluginContext extends CorePluginContext {
    sourceFile: ts.SourceFile;
}

export type SyntaxNodeInfo = {
    sourceFile: ts.SourceFile;
    minNode: ts.Node;
};

export type SyntaxNodeInfoEx = SyntaxNodeInfo & {
    targetNode: ts.Node;
};

export type NgComponentTypeInfo = {
    controllerAs: string;
    controllerType?: ts.Type;
    bindings: Map<string, string>;
};

export type ProjectInfo = {
    info: ts.server.PluginCreateInfo;
    modules: {
        typescript: typeof import('typescript/lib/tsserverlibrary');
    };
};

export type GetCoreContextFn = () => CorePluginContext | undefined;
export type GetCoreContextFnViaFilePath = (filePath: string) => CorePluginContext | undefined;
export type GetContextFnViaFilePath = (filePath: string) => PluginContext | undefined;

export type NgHelperServer = {
    updateConfig: (cfg: NgPluginConfiguration) => void;
    addProject: (projectInfo: ProjectInfo) => () => void;
    getContext: GetContextFnViaFilePath;
    getCoreContext: GetCoreContextFnViaFilePath;
    isExtensionActivated: () => boolean;
    getComponentDirectiveMap: (filePath: string) => Map<string, NgComponentDirectiveFileInfo> | undefined;
    getTsCtrlMap: (filePath: string) => Map<string, NgTsCtrlFileInfo> | undefined;
    refreshInternalMaps: (filePath: string) => void;
};

export interface FileVersion {
    version: string;
}

export interface NgComponentDirectiveFileInfo extends NgComponentDirectiveNamesInfo, FileVersion {}

export interface NgTsCtrlFileInfo extends FileVersion {
    controllerName: string;
}
