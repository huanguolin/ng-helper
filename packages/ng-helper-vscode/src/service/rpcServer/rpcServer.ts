import { parseRpcMessage, RPC_HEARTBEAT_INTERVAL, RpcServeType } from '@ng-helper/shared/lib/rpc';
import { Disposable } from 'vscode';
import WebSocket from 'ws';

import type { ProcessReportData } from '../processMessage';
import type { State } from '../stateControl';

interface Ws extends WebSocket {
    serveType?: RpcServeType;
}

type RpcServerEvent = 'message' | 'report';
type RpcServerMessageListener = (data: string) => void;
type ProcessReportListener = (data: ProcessReportData) => void;

type RpcServerListener<T extends RpcServerEvent> = T extends 'message'
    ? RpcServerMessageListener
    : T extends 'report'
      ? ProcessReportListener
      : never;

export class RpcServer implements Disposable {
    private _wss: WebSocket.Server;
    private _ws: Ws | null = null;
    private _listeners: Map<RpcServerEvent, RpcServerListener<RpcServerEvent>[]> = new Map();

    constructor(port: number) {
        this._wss = new WebSocket.Server({ port });
        this.initServer();
    }

    send(message: string) {
        this.ws?.send(message);
    }

    addEventListener<T extends RpcServerEvent>(event: T, listener: RpcServerListener<T>) {
        const listeners = this._listeners.get(event) || [];
        listeners.push(listener);
        this._listeners.set(event, listeners);

        return () => {
            const currentListeners = this._listeners.get(event);
            if (currentListeners) {
                this._listeners.set(
                    event,
                    currentListeners.filter((l) => l !== listener),
                );
            }
        };
    }

    dispose() {
        this._listeners.clear();
        this._wss.close();
    }

    private get ws() {
        return this._ws;
    }

    private set ws(v) {
        this._ws = v;
        this.report(v ? 'connected' : 'disconnect');
    }

    private report(state: State, path?: string) {
        this._listeners.get('report')?.forEach((listener) => {
            (listener as ProcessReportListener)({ state, path });
        });
    }

    private receiveMessage(message: string) {
        this._listeners.get('message')?.forEach((listener) => {
            (listener as RpcServerMessageListener)(message);
        });
    }

    private initServer() {
        this._wss.on('connection', (ws: Ws) => {
            ws.once('message', (message) => {
                // eslint-disable-next-line @typescript-eslint/no-base-to-string
                const msgStr = message.toString('utf8');

                const msg = parseRpcMessage('auth', msgStr);
                if (!msg || msg.data.serveType !== 'srv') {
                    ws.terminate();
                    return;
                }

                ws.serveType = msg.data.serveType;
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

        this.handleWsHeartbeat(ws);

        ws.on('message', (message) => {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            this.receiveMessage(message.toString('utf8'));
        });
        ws.on('error', (_error) => {
            // TODO: handle error
        });
        ws.on('close', () => {
            this.removeTargetWs();
        });
    }

    private removeTargetWs() {
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
            clearTimeout(pingTimeout);
            nextPing();
        });
    }
}
