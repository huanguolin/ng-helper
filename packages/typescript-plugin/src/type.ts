import { NgComponentNameInfo, NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
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
    node: ts.Node;
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
    addProject: (projectInfo: ProjectInfo) => (() => void) | undefined;
    getContext: GetContextFnViaFilePath;
    getCoreContext: GetCoreContextFnViaFilePath;
    isExtensionActivated: () => boolean;
    getComponentMap: (filePath: string) => Map<string, NgComponentFileInfo> | undefined;
    refreshInternalMaps: (filePath: string) => void;
};

export interface TsFileInfo {
    version: string;
}

export interface NgComponentFileInfo extends NgComponentNameInfo, TsFileInfo {}

export interface NgTsCtrlFileInfo extends TsFileInfo {
    controllerName: string;
}
