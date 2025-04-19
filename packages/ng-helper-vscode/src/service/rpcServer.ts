import { parseRpcMessage, RPC_HEARTBEAT_INTERVAL, RpcServeType } from '@ng-helper/shared/lib/rpc';
import { Disposable } from 'vscode';
import WebSocket, { WebSocketServer } from 'ws';

export enum RpcServerStatus {
    Disconnected = 0,
    Connecting = 1,
    Ready = 2,
}

export interface Ws extends WebSocket {
    serveType?: RpcServeType;
}

export class RpcServer implements Disposable {
    private _wss: WebSocketServer;
    private _ws: Ws | null = null;
    private _isConnecting: boolean = false;
    private _statusListener: ((status: RpcServerStatus) => void) | null = null;
    private _lastStatus?: RpcServerStatus;

    constructor(private _port: number) {
        this._wss = new WebSocketServer({ port: this._port });
        this.initServer();
    }

    onStatusChange(listener: (status: RpcServerStatus) => void) {
        this._statusListener = listener;
        // 首次无条件调用
        this._statusListener(this.status);
    }

    get status() {
        if (this._ws !== null) {
            return RpcServerStatus.Ready;
        }
        if (this._isConnecting) {
            return RpcServerStatus.Connecting;
        }
        return RpcServerStatus.Disconnected;
    }

    query() {
        if (this.status !== RpcServerStatus.Ready) {
            throw new Error('TsService is not ready');
        }
        return this._ws;
    }

    dispose() {
        this._wss.close();
    }

    private initServer() {
        this._wss.on('connection', (ws: Ws) => {
            console.log(`RpcServer: new connect`);

            ws.once('message', (message) => {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const msgStr = message.toString('utf8');
                console.log(`RpcServer: ws message: `, msgStr);

                const msg = parseRpcMessage('auth', msgStr);
                if (!msg || msg.data.serveType !== 'srv') {
                    console.log(`RpcServer: invalid auth message: `, msgStr);
                    ws.terminate();
                    return;
                }
                // TODO: handle hc message

                ws.serveType = msg.data.serveType;
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
        this.callStatusListener();

        this.handleWsHeartbeat(ws);

        ws.on('error', (error) => {
            console.log(`RpcServer: ws error: `, error);
        });
        ws.on('close', () => {
            this.removeTargetWs();
        });
    }

    private removeTargetWs() {
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
            console.log(`RpcServer: ws pong, `, Math.floor(Date.now() / 1000));
            clearTimeout(pingTimeout);
            nextPing();
        });
    }

    private callStatusListener() {
        const currentStatus = this.status;
        console.log(`TsService: callStatusListener() currentStatus: ${currentStatus}`);
        if (this._lastStatus !== currentStatus) {
            this._statusListener?.(currentStatus);
        }
        this._lastStatus = currentStatus;
    }
}
