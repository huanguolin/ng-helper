import * as http from 'http';

import {
    NgCompletionRequest,
    NgCompletionResponse,
    NgHoverRequest,
    NgHoverResponse,
    NgPluginConfiguration,
    NgRequest,
} from '@ng-helper/shared/lib/plugin';
import express from 'express';
import type ts from 'typescript/lib/tsserverlibrary';

import { getComponentCompletions, getComponentControllerAs } from './completion';
import { getComponentHoverType } from './hover';
import { CorePluginContext, GetCoreContextFn, NgHelperServer, PluginContext, PluginLogger, ProjectInfo } from './type';
import { buildLogger } from './utils/log';

export const ngHelperServer = createNgHelperServer();

function createNgHelperServer(): NgHelperServer {
    const _express = initHttpServer();
    const _getContextMap = new Map<string, GetCoreContextFn>();
    let _httpServer: http.Server | undefined;
    let _config: Partial<NgPluginConfiguration> | undefined;

    return {
        isExtensionActivated,
        updateConfig,
        addProject,
        getContext,
        getCoreContext,
    };

    function isExtensionActivated() {
        return !!_config?.port;
    }

    function updateConfig(cfg: Partial<NgPluginConfiguration>) {
        if (_config?.port !== cfg.port && cfg.port) {
            _httpServer?.close();
            _httpServer = _express.listen(cfg.port);
        }

        _config = cfg;

        // log record
        if (_getContextMap.size > 0) {
            const { value: getCoreContext } = _getContextMap.values().next() as { value: GetCoreContextFn; done: boolean };
            getCoreContext()?.logger.info('updateConfig(): config:', cfg);
        }
    }

    function addProject(projectInfo: ProjectInfo): (() => void) | undefined {
        const { info, modules } = projectInfo;
        const logger = buildLogger(modules.typescript, info);
        const initLogger = logger.prefix('[init]');

        initLogger.startGroup();
        initLogger.info('start with info.config:', info.config);

        if (!_config) {
            updateConfig(info.config as Partial<NgPluginConfiguration>);
        }

        const projectRoot = projectInfo.info.project.getCurrentDirectory();
        initLogger.info('project root from ts server:', projectRoot);

        const getCoreContext = buildGetCoreContextFunc({ info, logger, modules });

        _getContextMap.set(projectRoot, getCoreContext);

        initLogger.info('end with projectRoot:', projectRoot);
        initLogger.endGroup();

        return removeProject;

        function removeProject() {
            if (projectRoot) {
                _getContextMap.delete(projectRoot);
                initLogger.info('dispose:', projectRoot);
                if (_getContextMap.size === 0) {
                    _httpServer?.close();
                    initLogger.info('close http server.');
                }
            }
        }
    }

    function getCoreContext(filePath: string): CorePluginContext | undefined {
        const projectRoot = getProjectRoot(filePath);
        if (!projectRoot) {
            return;
        }

        const fn = _getContextMap.get(projectRoot);
        if (!fn) {
            return;
        }

        const coreCtx = fn();
        if (!coreCtx) {
            return;
        }

        coreCtx.logger.info('getCoreContext() via projectRoot:', projectRoot);
        return coreCtx;
    }

    function getContext(filePath: string): PluginContext | undefined {
        const coreCtx = getCoreContext(filePath);
        if (!coreCtx) {
            return;
        }

        const sourceFile = coreCtx.program.getSourceFile(filePath);
        if (!sourceFile) {
            coreCtx.logger.info('getContext()', 'get source file failed');
            return;
        }

        return Object.assign({ sourceFile }, coreCtx);
    }

    function getProjectRoot(filePath: string): string | undefined {
        const paths = Array.from(_getContextMap.keys());
        paths.sort((a, b) => b.length - a.length);
        for (const projectRoot of paths) {
            if (filePath.startsWith(projectRoot)) {
                return projectRoot;
            }
        }
    }
}

function buildGetCoreContextFunc({ info, logger, modules }: ProjectInfo & { logger: PluginLogger }): GetCoreContextFn {
    return getCoreContext;

    function getCoreContext(): CorePluginContext | undefined {
        const program = info.project['program'] as ts.Program | undefined;

        if (!program) {
            logger.info('getCoreContext()', 'get program failed');
            return;
        }

        const typeChecker = program.getTypeChecker();

        return {
            program,
            typeChecker,
            ts: modules.typescript,
            logger,
        };
    }
}

function initHttpServer() {
    const app = express();
    app.use(express.json());

    app.get('/ng-helper/hc', (_, res) => res.send());

    app.post('/ng-helper/component/controller-as', (req, res) => {
        handleRequestWithCtx<NgRequest, string | undefined>({ req, res, action: (ctx) => getComponentControllerAs(ctx) });
    });

    app.post('/ng-helper/component/completion', (req, res) => {
        handleRequestWithCtx<NgCompletionRequest, NgCompletionResponse>({
            req,
            res,
            action: (ctx, body) => getComponentCompletions(ctx, body.prefix),
        });
    });

    app.post('/ng-helper/component/hover', (req, res) => {
        handleRequestWithCtx<NgHoverRequest, NgHoverResponse>({
            req,
            res,
            action: (ctx, body) => getComponentHoverType(ctx, body),
        });
    });

    return app;
}

function handleRequestWithCtx<TBody extends NgRequest, TResponse>({
    req,
    res,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<TResponse>;
    action: (ctx: PluginContext, body: TBody) => TResponse;
}) {
    return handleRequest({ req, res, resolveCtx: (body) => ngHelperServer.getContext(body.fileName), action });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleRequestWithCoreCtx<TBody extends NgRequest, TResponse>({
    req,
    res,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<TResponse>;
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
    res: express.Response<TResponse>;
    resolveCtx: (body: TBody) => TCtx | undefined;
    action: (ctx: TCtx, body: TBody) => TResponse;
}) {
    const body = req.body;
    const ctx = resolveCtx(body);
    if (!ctx) {
        return res.send('<====== NO CONTEXT ======>' as unknown as TResponse);
    }

    ctx.logger.startGroup();
    try {
        ctx.logger.info('request:', body);
        const response = action(ctx, body);
        res.send(response);
        ctx.logger.info('response:', response);
    } catch (error) {
        ctx.logger.error(req.url, (error as Error).message, (error as Error).stack);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        res.status(500).send(error as any);
    } finally {
        ctx.logger.endGroup();
    }
}