import type { ProcessReportData, ProcessControlData, ProcessMessage, ProcessMessageType } from '../processMessage';

import { RpcServer } from './rpcServer';
import { rpcProcessLogger } from './utils';

const logger = rpcProcessLogger;

let rpcServer: RpcServer | null = null;

process.on('message', (message: ProcessMessage) => {
    logger.logDebug(`Received message from parent process: ${JSON.stringify(message)}`);

    if (message.type === 'control') {
        const data = message.data as ProcessControlData;
        if (data.type === 'startWsServer') {
            initRpcServer(data);
        } else if (data.type === 'exit') {
            rpcServer?.dispose();
            process.exit(0);
        }
    } else if (message.type === 'query') {
        if (rpcServer) {
            rpcServer.send(message.data as string);
        } else {
            sendReportMessage({ state: 'canNotQuery' });
        }
    }
});

function initRpcServer(data: ProcessControlData): void {
    if (!rpcServer) {
        rpcServer = new RpcServer(data.port!);
        rpcServer.addEventListener('message', sendQueryResponse);
        rpcServer.addEventListener('report', sendReportMessage);
    }
}

function sendReportMessage(data: ProcessReportData): void {
    sendMessageToParent('report', data);
}

function sendQueryResponse(message: string): void {
    sendMessageToParent('query', message);
}

function sendMessageToParent<T>(type: ProcessMessageType, data: T): void {
    const message: ProcessMessage<T> = {
        type,
        data,
        timestamp: Date.now(),
    };
    logger.logDebug(`Sending message to parent process: ${JSON.stringify(message)}`);
    process.send?.(message);
}
