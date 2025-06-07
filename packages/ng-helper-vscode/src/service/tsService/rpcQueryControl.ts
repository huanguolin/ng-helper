import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import { packRpcMessage, parseRpcMessage } from '@ng-helper/shared/lib/rpc';
import type { CancellationToken } from 'vscode';

import { logger } from '../../logger';
import type { StateControl } from '../stateControl';

import type { RpcControl } from './rpcControl';

const RPC_TIMEOUT = 500;

const myLogger = logger.prefixWith('RpcQueryControl');

export class RpcQueryControl {
    private _rpcControl: RpcControl;
    private _stateControl: StateControl;
    private _id = 0;
    private _cbMap = new Map<string, (result: string | undefined) => void>();

    constructor(rpcControl: RpcControl, stateControl: StateControl) {
        this._rpcControl = rpcControl;
        this._stateControl = stateControl;
        this._rpcControl.listenQueryMessage((message) => {
            this.handleQueryResponse(message);
        });
    }

    async query<TResult, TParams extends NgRequest = NgRequest>(
        method: string,
        params: TParams,
        apiName: string,
        cancelToken?: CancellationToken,
    ): Promise<TResult | undefined> {
        if (!this._stateControl.rpcServerReady) {
            this._stateControl.updateState('canNotQuery', params.fileName);
            return;
        }

        try {
            const id = this.getId();
            const rpcRequest = packRpcMessage('request', {
                id,
                method,
                params: JSON.stringify(params),
            });

            myLogger.logInfo(`(${id}) ---> ${apiName}() : ${rpcRequest}`);

            this._rpcControl.sendQueryMessage(rpcRequest);

            const result = await Promise.race([
                this.timeoutOrCancel(id, cancelToken),
                this.getQueryResult<TResult>(id),
            ]);
            return result;
        } catch (err) {
            myLogger.logError(`${apiName}() error:`, err);
        }
    }

    private handleQueryResponse(message: string) {
        myLogger.logDebug(`Received query response: ${message}`);

        try {
            const response = parseRpcMessage('response', message, true);
            if (response) {
                const { requestId, success, result, error } = response.data;
                const cb = this._cbMap.get(requestId);
                if (cb) {
                    cb(result);
                    this._cbMap.delete(requestId);
                }
                if (!success) {
                    myLogger.logError(`Query response error(${error?.errorKey}): ${error?.errorMessage}`);
                    if (error?.errorKey === 'NO_CONTEXT') {
                        this._stateControl.updateState('noContext', error.data as string);
                    }
                }
            } else {
                const report = parseRpcMessage('report', message, true);
                if (report) {
                    this._stateControl.updateState(report.data.type, report.data.projectRoot);
                }
            }
        } catch (err) {
            myLogger.logError(`handleQueryResponse() error:`, err);
        }
    }

    private getQueryResult<TResult>(id: string): Promise<TResult> {
        return new Promise<TResult>((r) => {
            this.addCb(id, (result: string | undefined) => {
                const queryResult = (result ? JSON.parse(result) : undefined) as TResult;
                myLogger.logInfo(`(${id}) <--- :`, queryResult);
                r(queryResult);
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
