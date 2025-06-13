import type { ExtensionContext, TextDocument } from 'vscode';

import type { NgHelperConfig } from './config';
import { getNormalizedPathFromDocument } from './features/utils';
import type { RpcApi } from './service/tsService/rpcApi';

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

        const ngProjectPaths = Array.from(Object.values(ngProjects));
        return ngProjectPaths.some((p) => filePath.startsWith(p));
    }
}
