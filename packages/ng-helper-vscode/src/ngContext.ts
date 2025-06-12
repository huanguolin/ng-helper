import type { ExtensionContext, TextDocument } from 'vscode';

import type { NgHelperConfig } from './config';
import { getNormalizedPathFromDocument } from './features/utils';
import type { RpcApi } from './service/tsService/rpcApi';
import { getWorkspacePath, normalizePath } from './utils';

export class NgContext {
    constructor(
        public vscodeContext: ExtensionContext,
        public config: NgHelperConfig,
        public rpcApi: RpcApi,
    ) {}

    isNgProjectDocument(document: TextDocument): boolean {
        const filePath = getNormalizedPathFromDocument(document);
        return this.isNgProjectFile(filePath);
    }

    isNgProjectFile(filePath: string): boolean {
        const ngProjects = this.config.userConfig.angularJsProjects;
        if (!ngProjects) {
            return true;
        }

        const workspacePath = getWorkspacePath()!.fsPath;
        const normalizeProjectPath = (p: string) => normalizePath(workspacePath + '/' + p);
        const ngProjectPaths = Array.from(Object.values(ngProjects)).map((p) => normalizeProjectPath(p));
        return ngProjectPaths.some((p) => filePath.startsWith(p));
    }
}
