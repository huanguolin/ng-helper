import type { ExtensionContext } from 'vscode';

import type { NgHelperConfig } from './activate';
import type { RpcApi } from './service/tsService/rpcApi';

export class NgContext {
    constructor(
        public vscodeContext: ExtensionContext,
        public config: NgHelperConfig,
        public rpcApi: RpcApi,
    ) {}
}
