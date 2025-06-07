import { fork } from 'child_process';
import path from 'path';

import type { ProcessControlData, ProcessMessage, ProcessMessageType, ProcessReportData } from '../processMessage';
import type { StateControl } from '../stateControl';

const rpcServerPath = path.join(__dirname, 'ng-helper-rpc-server.js');

export class RpcControl {
    private _childProc: ReturnType<typeof fork>;
    private _stateControl: StateControl;
    private _queryListener?: (message: string) => void;

    constructor(stateControl: StateControl) {
        this._stateControl = stateControl;
        this._childProc = fork(rpcServerPath, [], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    }

    start(port: number) {
        this.onMessage();
        this.sendControlMessage({ type: 'startWsServer', port });
    }

    dispose() {
        this.sendControlMessage({ type: 'exit' });
    }

    sendQueryMessage(message: string) {
        this.sendMessageToChild<string>('query', message);
    }

    listenQueryMessage(listener: (message: string) => void) {
        this._queryListener = listener;
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
