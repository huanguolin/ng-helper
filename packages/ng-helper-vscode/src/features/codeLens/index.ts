import { ExtensionContext } from 'vscode';

import type { RpcApi } from '../../service/tsService/rpcApi';

import { searchUseOfComponentOrDirective } from './useOfComponentOrDirective';

export function registerCodeLens(context: ExtensionContext, rpcApi: RpcApi) {
    context.subscriptions.push(searchUseOfComponentOrDirective(rpcApi));
}
