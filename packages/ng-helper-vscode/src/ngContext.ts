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
        return this.config.isNgProjectFile(filePath);
    }
}
