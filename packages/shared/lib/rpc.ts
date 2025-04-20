export const RPC_HEARTBEAT_INTERVAL = 5000;

export type RpcMessageType = 'request' | 'response' | 'auth';
export type RpcServeType = 'srv' | 'hc';
export type RpcErrorKey = 'NO_CONTEXT' | 'INTERNAL_ERROR';

export interface RpcAuth {
    serveType: RpcServeType;
}

export interface RpcRequest {
    id: string;
    method: string;
    params: string;
}

export interface RpcError {
    errorKey: 'METHOD_NOT_FOUND' | 'PARSE_PARAMS_ERROR' | 'NO_CONTEXT' | 'INTERNAL_ERROR';
    errorMessage: string;
}

export interface RpcResponse {
    requestId: string;
    success: boolean;
    result?: string;
    error?: RpcError;
}

export interface RpcPackMessage<TypeT extends RpcMessageType, DataT> {
    type: TypeT;
    data: DataT;
    timestamp: number;
}

export type RpcData<T extends RpcMessageType> = T extends 'auth'
    ? RpcAuth
    : T extends 'request'
      ? RpcRequest
      : T extends 'response'
        ? RpcResponse
        : never;

export type RpcMessage<T extends RpcMessageType> = RpcPackMessage<T, RpcData<T>>;

export function parseRpcMessage<T extends RpcMessageType>(
    type: T,
    message: string,
    throwOnError = false,
): RpcMessage<T> | null {
    try {
        const msg = JSON.parse(message) as RpcMessage<T>;
        if (msg.type === type) {
            return msg;
        }
    } catch (err) {
        const errInfo = `Failed to parse rpc message(${message}): ${err as string}`;
        if (throwOnError) {
            throw new Error(errInfo);
        } else {
            console.error(errInfo);
        }
    }
    return null;
}

export function packRpcMessage<T extends RpcMessageType>(type: T, data: RpcData<T>): string {
    return JSON.stringify({ type, data, timestamp: Date.now() });
}
