import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import { packRpcMessage, parseRpcMessage } from '@ng-helper/shared/lib/rpc';
import type { CancellationToken } from 'vscode';
import type WebSocket from 'ws';

const TIMEOUT = 5000;

export class RpcQueryCenter {
    private _id = 0;
    private _ws: WebSocket;
    private _cbMap = new Map<string, (result: unknown) => void>();

    constructor(ws: WebSocket) {
        this._ws = ws;
        this.updateWs(ws);
    }

    updateWs(ws: WebSocket) {
        this._ws = ws;
        ws.on('message', (message) => {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            const msgStr = message.toString('utf8');
            console.log(`RpcQueryCenter: ws message: `, msgStr);

            const response = parseRpcMessage('response', msgStr);
            if (response) {
                const { requestId, success, result, error } = response.data;
                const cb = this._cbMap.get(requestId);
                if (cb) {
                    cb(success ? result : undefined);
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

        cancelToken?.onCancellationRequested(() => {
            this.removeCb(id);
            console.log(`${apiName}() cancelled by vscode.`);
        });

        const result = await Promise.race([this.timeout(id), this.getQueryResult<TResult>(id)]);
        return result;
    }

    private getQueryResult<TResult>(id: string): Promise<TResult> {
        return new Promise<TResult>((r) => {
            this.addCb(id, (result: unknown) => {
                r(result as TResult);
            });
        });
    }

    private timeout(id: string): Promise<undefined> {
        return new Promise<undefined>((r) =>
            setTimeout(() => {
                this.removeCb(id);
                r(undefined);
            }, TIMEOUT),
        );
    }

    private addCb(id: string, cb: (result: unknown) => void) {
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
