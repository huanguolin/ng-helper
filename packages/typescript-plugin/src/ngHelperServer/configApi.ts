import type {
    NgListComponentsStringAttrsRequest,
    NgComponentsStringAttrsResponse,
    NgRequest,
    NgTypeCompletionRequest,
    NgTypeCompletionResponse,
    NgComponentNameCompletionResponse,
    NgComponentAttrCompletionRequest,
    NgComponentAttrCompletionResponse,
    NgDirectiveCompletionRequest,
    NgDirectiveCompletionResponse,
    NgCtrlTypeCompletionRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgDirectiveHoverRequest,
    NgComponentNameOrAttrNameDefinitionRequest,
    NgDefinitionResponse,
    NgTypeDefinitionRequest,
    NgCtrlTypeDefinitionRequest,
    NgDirectiveDefinitionRequest,
    NgControllerNameDefinitionRequest,
    NgResponse,
} from '@ng-helper/shared/lib/plugin';
import express from 'express';

import {
    getComponentControllerAs,
    getComponentTypeCompletions,
    getComponentNameCompletions,
    getComponentAttrCompletions,
    getDirectiveCompletions,
    getControllerTypeCompletions,
} from '../completion';
import {
    getComponentNameOrAttrNameDefinitionInfo,
    getComponentTypeDefinitionInfo,
    getControllerNameDefinitionInfo,
    getControllerTypeDefinitionInfo,
    getDirectiveDefinitionInfo,
} from '../definition';
import { getComponentTypeHoverInfo, getComponentNameOrAttrNameHoverInfo, getControllerTypeHoverInfo, getDirectiveHoverInfo } from '../hover';
import { getComponentsStringAttrsInfo } from '../other';
import type { PluginContext, CorePluginContext } from '../type';

import { ngHelperServer } from '.';

export function configApi(app: express.Application) {
    configCompletionApi(app);

    configHoverApi(app);

    configDefinitionApi(app);

    app.post('/ng-helper/components/string/attrs', (req, res) => {
        handleRequestWithCoreCtx<NgListComponentsStringAttrsRequest, NgComponentsStringAttrsResponse>({
            req,
            res,
            action: (ctx, body) => getComponentsStringAttrsInfo(ctx, body),
        });
    });

    app.post('/ng-helper/component/controller-as', (req, res) => {
        handleRequestWithCtx<NgRequest, string | undefined>({ req, res, action: (ctx) => getComponentControllerAs(ctx) });
    });

    app.get('/ng-helper/hc', (_, res) => res.send('ok'));
}

function configDefinitionApi(app: express.Application) {
    app.post('/ng-helper/controller/name/definition', (req, res) => {
        handleRequestWithCtx<NgControllerNameDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (ctx, body) => getControllerNameDefinitionInfo(ctx, body),
        });
    });

    app.post('/ng-helper/component/name/definition', (req, res) => {
        handleRequestWithCoreCtx<NgComponentNameOrAttrNameDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (coreCtx, body) => getComponentNameOrAttrNameDefinitionInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/component/attr/definition', (req, res) => {
        handleRequestWithCoreCtx<NgComponentNameOrAttrNameDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (coreCtx, body) => getComponentNameOrAttrNameDefinitionInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/component/type/definition', (req, res) => {
        handleRequestWithCtx<NgTypeDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (ctx, body) => getComponentTypeDefinitionInfo(ctx, body),
        });
    });

    app.post('/ng-helper/controller/type/definition', (req, res) => {
        handleRequestWithCoreCtx<NgCtrlTypeDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (coreCtx, body) => getControllerTypeDefinitionInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/directive/definition', (req, res) => {
        handleRequestWithCoreCtx<NgDirectiveDefinitionRequest, NgDefinitionResponse>({
            req,
            res,
            action: (coreCtx, body) => getDirectiveDefinitionInfo(coreCtx, body),
        });
    });
}

function configHoverApi(app: express.Application) {
    app.post('/ng-helper/component/type/hover', (req, res) => {
        handleRequestWithCtx<NgHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (ctx, body) => getComponentTypeHoverInfo(ctx, body),
        });
    });

    app.post('/ng-helper/component/name/hover', (req, res) => {
        handleRequestWithCoreCtx<NgComponentNameOrAttrNameHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (coreCtx, body) => getComponentNameOrAttrNameHoverInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/component/attr/hover', (req, res) => {
        handleRequestWithCoreCtx<NgComponentNameOrAttrNameHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (coreCtx, body) => getComponentNameOrAttrNameHoverInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/controller/type/hover', (req, res) => {
        handleRequestWithCoreCtx<NgCtrlHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (coreCtx, body) => getControllerTypeHoverInfo(coreCtx, body),
        });
    });

    app.post('/ng-helper/directive/hover', (req, res) => {
        handleRequestWithCoreCtx<NgDirectiveHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (coreCtx, body) => getDirectiveHoverInfo(coreCtx, body),
        });
    });
}

function configCompletionApi(app: express.Application) {
    app.post('/ng-helper/component/type/completion', (req, res) => {
        handleRequestWithCtx<NgTypeCompletionRequest, NgTypeCompletionResponse>({
            req,
            res,
            action: (ctx, body) => getComponentTypeCompletions(ctx, body.prefix),
        });
    });

    app.post('/ng-helper/component/name/completion', (req, res) => {
        handleRequestWithCoreCtx<NgRequest, NgComponentNameCompletionResponse>({
            req,
            res,
            action: (ctx, body) => getComponentNameCompletions(ctx, body.fileName),
        });
    });

    app.post('/ng-helper/component/attr/completion', (req, res) => {
        handleRequestWithCoreCtx<NgComponentAttrCompletionRequest, NgComponentAttrCompletionResponse>({
            req,
            res,
            action: (coreCtx, body) => getComponentAttrCompletions(coreCtx, body.fileName, body.componentName),
        });
    });

    app.post('/ng-helper/directive/completion', (req, res) => {
        handleRequestWithCoreCtx<NgDirectiveCompletionRequest, NgDirectiveCompletionResponse>({
            req,
            res,
            action: (coreCtx, body) => getDirectiveCompletions(coreCtx, body),
        });
    });

    app.post('/ng-helper/controller/type/completion', (req, res) => {
        handleRequestWithCoreCtx<NgCtrlTypeCompletionRequest, NgTypeCompletionResponse>({
            req,
            res,
            action: (coreCtx, body) => getControllerTypeCompletions(coreCtx, body),
        });
    });
}

function handleRequestWithCtx<TBody extends NgRequest, TResponse>({
    req,
    res,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<NgResponse<TResponse>>;
    action: (ctx: PluginContext, body: TBody) => TResponse;
}) {
    return handleRequest({ req, res, resolveCtx: (body) => ngHelperServer.getContext(body.fileName), action });
}

function handleRequestWithCoreCtx<TBody extends NgRequest, TResponse>({
    req,
    res,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<NgResponse<TResponse>>;
    action: (ctx: CorePluginContext, body: TBody) => TResponse;
}) {
    return handleRequest({ req, res, resolveCtx: (body) => ngHelperServer.getCoreContext(body.fileName), action });
}

function handleRequest<TCtx extends CorePluginContext, TBody extends NgRequest, TResponse>({
    req,
    res,
    resolveCtx,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<NgResponse<TResponse>>;
    resolveCtx: (body: TBody) => TCtx | undefined;
    action: (ctx: TCtx, body: TBody) => TResponse;
}) {
    const body = req.body;
    const ctx = resolveCtx(body);
    if (!ctx) {
        return res.send({ errKey: 'NO_CONTEXT' });
    }

    ctx.logger.startGroup();
    try {
        ctx.logger.info('request:', body);
        const data = action(ctx, body);
        res.send({ data });
        ctx.logger.info('response:', data);
    } catch (error) {
        ctx.logger.error(req.url, (error as Error).message, (error as Error).stack);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        res.status(500).send(error as any);
    } finally {
        ctx.logger.endGroup();
    }
}
