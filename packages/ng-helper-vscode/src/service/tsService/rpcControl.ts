import { fork } from 'child_process';
import path from 'path';

import { logger } from '../../logger';
import type { ProcessControlData, ProcessMessage, ProcessMessageType, ProcessReportData } from '../processMessage';
import type { StateControl } from '../stateControl';

const myLogger = logger.prefixWith('RpcControl');
const rpcServerPath = path.join(__dirname, 'ng-helper-rpc-server.js');

export class RpcControl {
    private _childProc: ReturnType<typeof fork>;
    private _stateControl: StateControl;
    private _queryListener?: (message: string) => void;

    constructor(stateControl: StateControl) {
        this._stateControl = stateControl;
        this._childProc = fork(rpcServerPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
        this.handleChildProcessLog();
    }

    start(port: number) {
        this.onMessage();
        myLogger.logInfo(`Starting RPC server on port: ${port}`);
        this.sendControlMessage({ type: 'startWsServer', port });
    }

    dispose() {
        myLogger.logInfo(`Stopping RPC server process.`);
        this.sendControlMessage({ type: 'exit' });

        const timeout = setTimeout(() => {
            // Force kill the child process if it doesn't exit gracefully.
            this._childProc.kill();
        }, 500);

        this._childProc.once('exit', () => {
            clearTimeout(timeout);
        });
    }

    sendQueryMessage(message: string) {
        this.sendMessageToChild<string>('query', message);
    }

    listenQueryMessage(listener: (message: string) => void) {
        this._queryListener = listener;
    }

    private handleChildProcessLog() {
        // 注意：不要用 logger 替换这里的 console.log 和 console.error。
        this._childProc.stderr?.on('data', (data) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            console.error(data.toString('utf8'));
        });
        this._childProc.stdout?.on('data', (data) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            console.log(data.toString('utf8'));
        });
    }

    private onMessage() {
        this._childProc.on('message', (message: ProcessMessage) => {
            if (message.type === 'query') {
                this._queryListener?.(message.data as string);
            } else if (message.type === 'report') {
                const { state, path } = message.data as ProcessReportData;
                this._stateControl.updateState(state, path);
            }
        });
    }

    private sendControlMessage(data: ProcessControlData) {
        this.sendMessageToChild<ProcessControlData>('control', data);
    }

    private sendMessageToChild<T>(type: ProcessMessageType, data: T) {
        this._childProc.send({
            type,
            data,
            timestamp: Date.now(),
        });
    }
}
