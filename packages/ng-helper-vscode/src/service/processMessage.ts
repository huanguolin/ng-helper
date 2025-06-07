import type { State } from './stateControl';

export type ProcessMessageType = 'control' | 'query' | 'report';

export type ProcessMessage<D = unknown> = {
    type: ProcessMessageType;
    data: D;
    timestamp: number;
};

export type ProcessControlData = {
    type: 'startWsServer' | 'exit';
    port?: number;
};

export type ProcessReportData = {
    state: State;
    path?: string;
};
