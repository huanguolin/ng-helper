import type { ExtensionContext } from 'vscode';

import type { NgHelperConfig } from './config';
import type { RpcApi } from './service/tsService/rpcApi';

export class NgContext {
    constructor(
        public vscodeContext: ExtensionContext,
        public config: NgHelperConfig,
        public rpcApi: RpcApi,
    ) {}

    isNgProjectFile(_filePath: string) {
        // TODO: impl
        return true;
    }
}
