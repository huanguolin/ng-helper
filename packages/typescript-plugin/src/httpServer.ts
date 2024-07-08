import { NgCompletionRequest, NgCompletionResponse, NgHoverRequest, NgHoverResponse, NgRequest } from '@ng-helper/shared/lib/plugin';
import express from 'express';

import { getComponentCompletions, getComponentControllerAs } from './completion';
import { getComponentHoverType } from './hover';
import { PluginContext } from './type';

export function initHttpServer(getContext: (fileName: string) => PluginContext | undefined) {
    const app = express();
    app.use(express.json());

    app.get('/ng-helper/hc', (_, res) => res.send());

    app.post('/ng-helper/component/controller-as', (req, res) => {
        handleRequest<NgRequest, string | undefined>({ req, res, getContext, action: (ctx) => getComponentControllerAs(ctx) });
    });

    app.post('/ng-helper/component/completion', (req, res) => {
        handleRequest<NgCompletionRequest, NgCompletionResponse>({
            req,
            res,
            getContext,
            action: (ctx, body) => getComponentCompletions(ctx, body.prefix),
        });
    });

    app.post('/ng-helper/component/hover', (req, res) => {
        handleRequest<NgHoverRequest, NgHoverResponse>({
            req,
            res,
            getContext,
            action: (ctx, body) => getComponentHoverType(ctx, body.contextString),
        });
    });

    return app;
}

function handleRequest<TBody extends NgRequest, TResponse>({
    req,
    res,
    getContext,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<TResponse>;
    getContext: (fileName: string) => PluginContext | undefined;
    action: (ctx: PluginContext, body: TBody) => TResponse;
}) {
    const body = req.body;
    const ctx = getContext(body.fileName);
    if (!ctx) {
        return res.send();
    }

    ctx.logger.startGroup();
    try {
        ctx.logger.info('request:', body);
        const response = action(ctx, body);
        res.send(response);
        ctx.logger.info('response:', response);
    } catch (error) {
        ctx.logger.error('getComponentControllerAs:', (error as Error).message, (error as Error).stack);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        res.status(500).send(error as any);
    } finally {
        ctx.logger.endGroup();
    }
}
