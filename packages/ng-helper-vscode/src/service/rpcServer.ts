import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import { parseRpcMessage, RPC_HEARTBEAT_INTERVAL, RpcServeType } from '@ng-helper/shared/lib/rpc';
import { Disposable, type CancellationToken } from 'vscode';
import WebSocket from 'ws';

import { log } from '../log';
import { normalizePath, time } from '../utils';

import { RpcQueryCenter } from './rpcQueryCenter';

export enum RpcServerStatus {
    Disconnected = 0,
    Connecting = 1,
    Ready = 2,
}

interface Ws extends WebSocket {
    serveType?: RpcServeType;
}

export class RpcServer implements Disposable {
    private _wss: WebSocket.Server;
    private _ws: Ws | null = null;
    private _lastIsReady = false;
    private _statusListener?: (isReady: boolean) => void;
    private _rpcQueryCenter?: RpcQueryCenter;

    constructor(port: number) {
        this._wss = new WebSocket.Server({ port });
        this.initServer();
    }

    onStatusChange(listener: (isReady: boolean) => void) {
        this._statusListener = listener;
        // 首次无条件调用
        this._statusListener(this.isReady);
    }

    get isReady() {
        return this._ws !== null;
    }

    async query<TResult, TParams extends NgRequest = NgRequest>(
        method: string,
        params: TParams,
        apiName: string,
        cancelToken?: CancellationToken,
    ): Promise<TResult | undefined> {
        if (!this.isReady) {
            this.logError('is not ready, query failed.');
            return;
        }

        params.fileName = normalizePath(params.fileName);

        console.group(`[rpc] ${apiName}()`);
        try {
            this.logInfo(`${apiName}() request: `, params);
            const result = await this._rpcQueryCenter?.query<TResult, TParams>(method, params, apiName, cancelToken);
            this.logInfo(`${apiName}() result: `, result);
            return result;
        } catch (error) {
            this.logError(`${apiName}() failed: `, error);
        } finally {
            console.groupEnd();
        }
    }

    dispose() {
        this._wss.close();
    }

    private initServer() {
        this._wss.on('connection', (ws: Ws) => {
            this.logInfo(`new 'ws' connect`);

            ws.once('message', (message) => {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const msgStr = message.toString('utf8');
                this.logDebug(`Received message: `, msgStr);

                const msg = parseRpcMessage('auth', msgStr);
                if (!msg || msg.data.serveType !== 'srv') {
                    this.logInfo(`invalid auth message: `, msgStr);
                    ws.terminate();
                    return;
                }

                // TODO: handle hc message

                ws.serveType = msg.data.serveType;
                this.logInfo(`new serve 'ws' to init`);
                this.initTargetWs(ws);
            });
        });

        this._wss.on('close', () => {
            this.removeTargetWs();
        });
    }

    private initTargetWs(ws: Ws) {
        this._ws?.terminate();

        this._ws = ws;
        this.initOrUpdateRpcQueryCenter(ws);
        this.callStatusListener();

        this.handleWsHeartbeat(ws);

        ws.on('error', (error) => {
            this.logError(error);
        });
        ws.on('close', () => {
            this.removeTargetWs();
        });
    }

    private initOrUpdateRpcQueryCenter(ws: Ws) {
        if (this._rpcQueryCenter) {
            this.logInfo(`update target ws`);
            this._rpcQueryCenter.updateWs(ws);
        } else {
            this.logInfo(`new RpcQueryCenter`);
            this._rpcQueryCenter = new RpcQueryCenter(ws);
        }
    }

    private removeTargetWs() {
        this.logInfo(`remove target ws`);
        this._ws?.terminate();
        this._ws = null;
        this.callStatusListener();
    }

    private handleWsHeartbeat(ws: Ws): void {
        let pingTimeout: NodeJS.Timeout | undefined;

        const nextPing = () => {
            if (ws.readyState !== WebSocket.OPEN) {
                return;
            }

            setTimeout(() => {
                ws.ping();
                pingTimeout = setTimeout(() => {
                    this.removeTargetWs();
                }, 500);
            }, RPC_HEARTBEAT_INTERVAL);
        };

        nextPing();
        ws.on('pong', () => {
            this.logDebug(`Received pong [${time()}]`);
            clearTimeout(pingTimeout);
            nextPing();
        });
    }

    private callStatusListener() {
        const currentStatus = this.isReady;
        if (this._lastIsReady !== currentStatus) {
            this.logInfo(`Status changed from ${this._lastIsReady} to ${currentStatus}`);
            this._statusListener?.(currentStatus);
        }
        this._lastIsReady = currentStatus;
    }

    private logDebug(...args: unknown[]) {
        log('D', `RpcServer(isReady: ${this.isReady}):`, ...args);
    }

    private logInfo(...args: unknown[]) {
        log('I', `RpcServer(isReady: ${this.isReady}):`, ...args);
    }

    private logError(...args: unknown[]) {
        log('E', `RpcServer(isReady: ${this.isReady}) Error:`, ...args);
    }
}
