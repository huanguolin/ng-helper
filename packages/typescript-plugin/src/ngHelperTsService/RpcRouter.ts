import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import type { RpcErrorKey, RpcRequest, RpcResponse } from '@ng-helper/shared/lib/rpc';

import type { CorePluginContext, PluginContext } from '../type';

import type { Log, RpcRequestHandler } from './rpcClient';

export type RpcMethodConfig = {
    isCoreCtx: boolean;
    handler: (ctx: CorePluginContext | PluginContext, ngRequest: NgRequest) => unknown;
};

export type ResolveCtx = (ngRequest: NgRequest, isCoreCtx: boolean) => CorePluginContext | PluginContext | undefined;

export class RpcRouter implements RpcRequestHandler {
    constructor(
        private _resolveCtx: ResolveCtx,
        private _methodMapping: Record<string, RpcMethodConfig>,
        private _log: Log,
    ) {}

    handleRequest(rpcRequest: RpcRequest): RpcResponse {
        try {
            return this.dispatchRequest(rpcRequest);
        } catch (error) {
            return this.rpcError(rpcRequest.id, 'INTERNAL_ERROR', `${error as string}`);
        }
    }

    private dispatchRequest(rpcRequest: RpcRequest): RpcResponse {
        const { method, params, id } = rpcRequest;

        const config = this._methodMapping[method];
        if (!config) {
            return this.rpcError(id, 'METHOD_NOT_FOUND', `Method not found: ${method}`);
        }

        const ngRequest = this.parseNgRequest(params);
        if (!ngRequest) {
            return this.rpcError(id, 'PARSE_PARAMS_ERROR', `Failed to parse params: ${params}`);
        }

        const ctx = this._resolveCtx(ngRequest, config.isCoreCtx);
        if (!ctx) {
            return this.rpcError(id, 'NO_CONTEXT', `No context for "${method}"`, ngRequest.fileName);
        }

        ctx.logger.startGroup();
        try {
            ctx.logger.info(`[rpc]#${id} ->`, ngRequest);
            const result = config.handler(ctx, ngRequest);
            ctx.logger.info(`[rpc]#${id} <-`, result);

            return {
                requestId: id,
                success: true,
                result: result ? JSON.stringify(result) : undefined,
            };
        } finally {
            ctx.logger.endGroup();
        }
    }

    private rpcError(requestId: string, errorKey: RpcErrorKey, errorMessage: string, data?: unknown): RpcResponse {
        const result = {
            requestId,
            success: false,
            error: {
                errorKey,
                errorMessage,
                data,
            },
        };

        this._log('[rpc router] Send error message:', result);

        return result;
    }

    private parseNgRequest(params: string): NgRequest | null {
        try {
            return JSON.parse(params) as NgRequest;
        } catch (error) {
            this._log('[rpc router] parseNgRequest() error:', error);
            return null;
        }
    }
}
