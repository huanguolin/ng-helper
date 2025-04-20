import type { NgRequest } from '@ng-helper/shared/lib/plugin';
import type { RpcRequest, RpcResponse } from '@ng-helper/shared/lib/rpc';

import type { CorePluginContext, PluginContext } from '../type';

import type { RpcRequestHandler } from './rpcClient';

export type RpcMethodConfig = {
    isCoreCtx: boolean;
    handler: (ctx: CorePluginContext | PluginContext, ngRequest: NgRequest) => unknown;
};

export type ResolveCtx = (ngRequest: NgRequest, isCoreCtx: boolean) => CorePluginContext | PluginContext | undefined;

export class RpcRouter implements RpcRequestHandler {
    constructor(
        private resolveCtx: ResolveCtx,
        private methodMapping: Record<string, RpcMethodConfig>,
    ) {}

    handleRequest(rpcRequest: RpcRequest): RpcResponse {
        try {
            return this.dispatchRequest(rpcRequest);
        } catch (error) {
            return {
                requestId: rpcRequest.id,
                success: false,
                error: { errorKey: 'INTERNAL_ERROR', errorMessage: JSON.stringify(error) },
            };
        }
    }

    private dispatchRequest(rpcRequest: RpcRequest): RpcResponse {
        const { method, params, id } = rpcRequest;

        const config = this.methodMapping[method];
        if (!config) {
            return {
                requestId: id,
                success: false,
                error: { errorKey: 'METHOD_NOT_FOUND', errorMessage: `Method not found: ${method}` },
            };
        }

        const ngRequest = this.parseNgRequest(params);
        if (!ngRequest) {
            return {
                requestId: id,
                success: false,
                error: { errorKey: 'PARSE_PARAMS_ERROR', errorMessage: `Failed to parse params: ${params}` },
            };
        }

        const ctx = this.resolveCtx(ngRequest, config.isCoreCtx);
        if (!ctx) {
            return {
                requestId: id,
                success: false,
                error: { errorKey: 'NO_CONTEXT', errorMessage: `No context for "${method}"` },
            };
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

    private parseNgRequest(params: string): NgRequest | null {
        try {
            return JSON.parse(params) as NgRequest;
        } catch (error) {
            return null;
        }
    }
}
