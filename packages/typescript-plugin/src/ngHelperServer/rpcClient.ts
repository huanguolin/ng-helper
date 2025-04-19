import type { NgRequest, NgResponse } from '@ng-helper/shared/lib/plugin';
import {
    packRpcMessage,
    parseRpcMessage,
    RPC_HEARTBEAT_INTERVAL,
    type RpcErrorKey,
    type RpcRequest,
} from '@ng-helper/shared/lib/rpc';
import WebSocket from 'ws';

import type { CorePluginContext, PluginContext } from '../type';

type Ws = WebSocket & { pingTimeout?: NodeJS.Timeout };

export type ErrorHandler = (error: unknown) => void;
export type RequestHandler = <TCtx extends CorePluginContext, TResponse>(
    ctx: TCtx,
    ngRequest: NgRequest,
) => NgResponse<TResponse>;
export type ResolveCtx = (ngRequest: NgRequest) => CorePluginContext | PluginContext | undefined;

export class RpcClient {
    private _ws?: Ws;
    private _port?: number;

    constructor(
        private _resolveCtx: ResolveCtx,
        private _onRequest?: RequestHandler,
        private _onError?: ErrorHandler,
    ) {}

    updateNgConfig(port?: number) {
        if (this._port !== port) {
            this.createWs(port);
        }

        this._port = port;
    }

    dispose(): void {
        this._ws?.terminate();
        this._ws = undefined;
    }

    private createWs(port?: number) {
        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        this._ws?.terminate();

        if (!port) {
            return;
        }

        this._ws = new WebSocket(`ws://localhost:${port}`) as Ws;
        this.auth();
        this.handleHeartbeat();
        this.handleMessage();
        this.handleError();
    }

    private auth() {
        this._ws?.once('open', () => {
            this._ws?.send(packRpcMessage('auth', { serveType: 'srv' }));
        });
    }

    private handleHeartbeat() {
        const heartbeat = (ws: Ws) => {
            clearTimeout(ws.pingTimeout);

            // Use `WebSocket#terminate()`, which immediately destroys the connection,
            // instead of `WebSocket#close()`, which waits for the close timer.
            // Delay should be equal to the interval at which your server
            // sends out pings plus a conservative assumption of the latency.
            ws.pingTimeout = setTimeout(() => {
                this.createWs(this._port);
            }, RPC_HEARTBEAT_INTERVAL + 500);
        };

        this._ws?.once('open', () => heartbeat(this._ws!));
        this._ws?.on('ping', () => heartbeat(this._ws!));
        this._ws?.on('close', () => {
            if (this._ws?.pingTimeout) {
                clearTimeout(this._ws.pingTimeout);
            }
            this._ws = undefined;
        });
    }

    private handleError() {
        this._ws?.on('error', (error) => this._onError?.(error));
    }

    private handleMessage() {
        this._ws?.on('message', (message) => {
            try {
                const rpcRequest = parseRpcMessage('request', message as unknown as string, true);
                if (rpcRequest) {
                    this.handleRequest(rpcRequest.data);
                }
            } catch (error) {
                this._onError?.(error);
            }
        });
    }

    private handleRequest(rpcRequest: RpcRequest) {
        try {
            const ngRequest = JSON.parse(rpcRequest.params) as NgRequest;
            const ctx = this._resolveCtx(ngRequest);
            if (!ctx) {
                this.respondError('NO_CONTEXT', '', rpcRequest.id);
                return;
            }

            this.handleNgRequest(ngRequest, ctx, rpcRequest.id);
        } catch (error) {
            this.respondError('INTERNAL_ERROR', error, rpcRequest.id);
            this._onError?.(error);
        }
    }

    private handleNgRequest(ngRequest: NgRequest, ctx: CorePluginContext, requestId: string) {
        ctx.logger.startGroup();
        const logger = ctx.logger.prefix(`[api][${requestId}]`);
        try {
            logger.info('->', ngRequest);
            const data = this._onRequest?.(ctx, ngRequest) ?? null;
            const responseStr = JSON.stringify(data);
            this._ws?.send(
                packRpcMessage('response', {
                    requestId,
                    success: true,
                    result: responseStr,
                }),
            );
            logger.info('<-', responseStr);
        } catch (error) {
            this.respondError('INTERNAL_ERROR', error, requestId);
            // 有 logger 记录就不用调用 _onError
            logger.error((error as Error).message, (error as Error).stack);
        } finally {
            ctx.logger.endGroup();
        }
    }

    private respondError(errorKey: RpcErrorKey, error: unknown, requestId: string) {
        this._ws?.send(
            packRpcMessage('response', {
                requestId,
                success: false,
                error: {
                    errorKey,
                    errorMessage: JSON.stringify(error),
                },
            }),
        );
    }
}
