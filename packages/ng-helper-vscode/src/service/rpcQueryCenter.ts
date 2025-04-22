import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import { packRpcMessage, parseRpcMessage } from '@ng-helper/shared/lib/rpc';
import type { CancellationToken } from 'vscode';
import type WebSocket from 'ws';

const RPC_TIMEOUT = 500;

export class RpcQueryCenter {
    private _id = 0;
    private _ws: WebSocket;
    private _cbMap = new Map<string, (result: string | undefined) => void>();

    constructor(ws: WebSocket) {
        this._ws = ws;
        this.updateWs(ws);
    }

    updateWs(ws: WebSocket) {
        this._ws = ws;
        ws.on('message', (message) => {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            const msgStr = message.toString('utf8');

            const response = parseRpcMessage('response', msgStr);
            if (response) {
                const { requestId, success, result, error } = response.data;
                const cb = this._cbMap.get(requestId);
                if (cb) {
                    cb(result);
                    this._cbMap.delete(requestId);
                }
                if (!success) {
                    // TODO: No context 处理
                    console.error(`RpcQueryCenter ws response error(${error?.errorKey}): ${error?.errorMessage}`);
                }
            }
        });
    }

    async query<TResult, TParams extends NgRequest = NgRequest>(
        method: string,
        params: TParams,
        apiName: string,
        cancelToken?: CancellationToken,
    ): Promise<TResult | undefined> {
        const id = this.getId();
        const rpcRequest = packRpcMessage('request', {
            id,
            method,
            params: JSON.stringify(params),
        });
        this._ws.send(rpcRequest);

        const result = await Promise.race([this.timeoutOrCancel(id, cancelToken), this.getQueryResult<TResult>(id)]);
        return result;
    }

    private getQueryResult<TResult>(id: string): Promise<TResult> {
        return new Promise<TResult>((r) => {
            this.addCb(id, (result: string | undefined) => {
                r((result ? JSON.parse(result) : undefined) as TResult);
            });
        });
    }

    private timeoutOrCancel(id: string, cancelToken?: CancellationToken): Promise<undefined> {
        return new Promise<undefined>((_, reject) => {
            const timeoutId = setTimeout(() => {
                this.removeCb(id);
                reject(new Error(`Rpc(#${id}) timeout(${RPC_TIMEOUT}ms)`));
            }, RPC_TIMEOUT);
            cancelToken?.onCancellationRequested(() => {
                this.removeCb(id);
                // 如果外面先取消，这里清除定时器，并直接 reject
                clearTimeout(timeoutId);
                reject(new Error(`Rpc(#${id}) query cancelled`));
            });
        });
    }

    private addCb(id: string, cb: (result: string | undefined) => void) {
        this._cbMap.set(id, cb);
    }

    private removeCb(id: string) {
        this._cbMap.delete(id);
    }

    private getId() {
        this._id++;
        return this._id.toString();
    }
}
