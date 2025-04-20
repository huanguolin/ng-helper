import {
    packRpcMessage,
    parseRpcMessage,
    RPC_HEARTBEAT_INTERVAL,
    type RpcRequest,
    type RpcResponse,
} from '@ng-helper/shared/lib/rpc';
import WebSocket from 'ws';

type Ws = WebSocket & { pingTimeout?: NodeJS.Timeout };

export type ErrorHandler = (error: unknown) => void;
export interface RpcRequestHandler {
    handleRequest(rpcRequest: RpcRequest): RpcResponse;
}

export class RpcClient {
    private _ws?: Ws;
    private _port?: number;

    constructor(
        private _rpcRequestHandler: RpcRequestHandler,
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
        this._ws?.once('open', () => this.heartbeat(this._ws!));
        this._ws?.on('ping', () => this.heartbeat(this._ws!));
        this._ws?.on('close', () => {
            clearTimeout(this._ws?.pingTimeout);
            this._ws = undefined;
        });
    }

    private heartbeat(ws: Ws) {
        clearTimeout(ws.pingTimeout);

        // Use `WebSocket#terminate()`, which immediately destroys the connection,
        // instead of `WebSocket#close()`, which waits for the close timer.
        // Delay should be equal to the interval at which your server
        // sends out pings plus a conservative assumption of the latency.
        ws.pingTimeout = setTimeout(() => {
            this.createWs(this._port);
        }, RPC_HEARTBEAT_INTERVAL + 500);
    }

    private handleError() {
        this._ws?.on('error', (error) => this._onError?.(error));
    }

    private handleMessage() {
        this._ws?.on('message', (message) => {
            try {
                const rpcRequest = parseRpcMessage('request', message as unknown as string, true);
                if (rpcRequest) {
                    const rpcResponse = this._rpcRequestHandler.handleRequest(rpcRequest.data);
                    this._ws?.send(packRpcMessage('response', rpcResponse));
                }
            } catch (error) {
                this._onError?.(error);
            }
        });
    }
}
