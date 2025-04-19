import { ExtensionContext } from 'vscode';

import type { RpcServer } from '../../service/rpcServer';

import { ngHelperStatusBar } from './ngHelperStatusBar';

export function registerStatusBar(context: ExtensionContext, rpcServer: RpcServer) {
    context.subscriptions.push(ngHelperStatusBar(rpcServer));
}
