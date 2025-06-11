import {
    packRpcMessage,
    parseRpcMessage,
    RPC_HEARTBEAT_INTERVAL,
    type RpcReportType,
    type RpcRequest,
    type RpcResponse,
} from '@ng-helper/shared/lib/rpc';
import WebSocket from 'ws';

type Ws = WebSocket & { pingTimeout?: NodeJS.Timeout };

export type Log = (msg: string, ...info: unknown[]) => void;

export interface RpcRequestHandler {
    handleRequest(rpcRequest: RpcRequest): RpcResponse;
}

const MIN_DELAY = 500;
const MAX_DELAY = RPC_HEARTBEAT_INTERVAL;

export class RpcClient {
    private _ws?: Ws;
    private _port?: number;
    private _isDispose = false;
    private _delay = MIN_DELAY;

    constructor(
        private _rpcRequestHandler: RpcRequestHandler,
        private _log: Log,
    ) {}

    updatePort(port?: number) {
        if (this._port !== port) {
            this.createWs(port);
        }

        this._port = port;
    }

    report(type: RpcReportType, projectRoot: string) {
        if (this._isDispose) {
            return;
        }

        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(packRpcMessage('report', { type, projectRoot }));
        } else {
            setTimeout(() => {
                this.report(type, projectRoot);
            }, MIN_DELAY);
        }
    }

    dispose(): void {
        this._isDispose = true;
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
        this.controlConnection();
        this.handleMessage();
        this.handleError();
    }

    private auth() {
        this._ws?.once('open', () => {
            this._log('[rpc client] Ws open.');

            this._delay = MIN_DELAY;
            this._ws?.send(packRpcMessage('auth', { serveType: 'srv' }));
        });
    }

    private controlConnection() {
        this._ws?.once('open', () => this.heartbeat(this._ws!));
        this._ws?.on('ping', () => this.heartbeat(this._ws!));
        this._ws?.on('close', () => {
            this._log('[rpc client] Ws close.');

            clearTimeout(this._ws?.pingTimeout);
            this._ws = undefined;

            if (this._isDispose) {
                return;
            }

            this.reconnection();
        });
    }

    private reconnection() {
        if (this._delay > MAX_DELAY) {
            this._delay = MIN_DELAY;
        } else {
            this._delay *= 2;
        }

        this._log('[rpc client] Reconnection() delay:', this._delay);

        setTimeout(() => {
            this.createWs(this._port);
        }, this._delay);
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
        this._ws?.on('error', (error) => this._log('[rpc client] Ws error:', error));
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
                this._log('[rpc client] Handle request error:', error);
            }
        });
    }
}
