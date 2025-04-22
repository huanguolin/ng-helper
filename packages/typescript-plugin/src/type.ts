import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { type NgCache } from './ngHelperTsService/ngCache';

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
    getConfig: () => Partial<NgPluginConfiguration> | undefined;
    addProject: (projectInfo: ProjectInfo) => () => void;
    getContext: GetContextFnViaFilePath;
    getCoreContext: GetCoreContextFnViaFilePath;
    isExtensionActivated: () => boolean;
    getCache: (filePath: string) => NgCache | undefined;
};

export interface FileVersion {
    version: string;
}
