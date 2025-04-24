import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import { parseRpcMessage, RPC_HEARTBEAT_INTERVAL, RpcServeType } from '@ng-helper/shared/lib/rpc';
import { Disposable, type CancellationToken } from 'vscode';
import WebSocket from 'ws';

import { log } from '../log';
import { normalizePath, time } from '../utils';

import { RpcQueryCenter } from './rpcQueryCenter';
import type { StateControl } from './stateControl';

interface Ws extends WebSocket {
    serveType?: RpcServeType;
}

export class RpcServer implements Disposable {
    private _stateControl: StateControl;
    private _wss: WebSocket.Server;
    private _ws: Ws | null = null;
    private _rpcQueryCenter?: RpcQueryCenter;

    constructor(port: number, stateControl: StateControl) {
        this._stateControl = stateControl;
        this._wss = new WebSocket.Server({ port });
        this.initServer();
    }

    async query<TResult, TParams extends NgRequest = NgRequest>(
        method: string,
        params: TParams,
        apiName: string,
        cancelToken?: CancellationToken,
    ): Promise<TResult | undefined> {
        if (!this.ws) {
            this._stateControl.updateState('disconnect');
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

    private get ws() {
        return this._ws;
    }

    private set ws(v) {
        this._ws = v;
        this._stateControl.updateState(v ? 'connected' : 'disconnect');
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
        this.ws?.terminate();

        this.ws = ws;
        this.initOrUpdateRpcQueryCenter(ws);

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
            this._rpcQueryCenter = new RpcQueryCenter(ws, this._stateControl);
        }
    }

    private removeTargetWs() {
        this.logInfo(`remove target ws`);
        this.ws?.terminate();
        this.ws = null;
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

    private logDebug(...args: unknown[]) {
        log('D', `RpcServer:`, ...args);
    }

    private logInfo(...args: unknown[]) {
        log('I', `RpcServer:`, ...args);
    }

    private logError(...args: unknown[]) {
        log('E', `RpcServer Error:`, ...args);
    }
}
