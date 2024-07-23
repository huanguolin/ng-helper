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
import { AddProjectResult, GetContextFn, NgHelperServer, PluginContext, PluginLogger, ProjectInfo } from './type';
import { buildLogger } from './utils/log';

export const ngHelperServer = createNgHelperServer();

function createNgHelperServer(): NgHelperServer {
    const _express = initHttpServer(resolveContext);
    const _getContextMap = new Map<string, GetContextFn>();
    let _httpServer: http.Server | undefined;
    let _config: Partial<NgPluginConfiguration> | undefined;

    return {
        isExtensionActivated,
        updateConfig,
        addProject,
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
    }

    function addProject(projectInfo: ProjectInfo): AddProjectResult | undefined {
        const { info, modules } = projectInfo;
        const logger = buildLogger(modules.typescript, info);
        const initLogger = logger.prefix('[init]');

        initLogger.startGroup();
        initLogger.info('start with info.config:', info.config);

        if (!_config) {
            updateConfig(info.config as Partial<NgPluginConfiguration>);
            initLogger.info('update _config to:', _config);
        }

        const projectRoot = projectInfo.info.project.getCurrentDirectory();
        initLogger.info('project root from ts server:', projectRoot);

        const getContext = buildGetContextFunc({
            info,
            logger,
            modules,
        });

        _getContextMap.set(projectRoot, getContext);

        initLogger.info('end with projectRoot:', projectRoot);
        initLogger.endGroup();

        return { removeProject, getContext };

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

    function resolveContext(filePath: string): PluginContext | undefined {
        const projectRoot = getProjectRoot(filePath);
        if (projectRoot) {
            const fn = _getContextMap.get(projectRoot);
            if (fn) {
                const ctx = fn(filePath);
                ctx?.logger.info('resolveContext(): projectRoot:', projectRoot);
                return ctx;
            }
        }
    }

    function getProjectRoot(filePath: string): string | undefined {
        const paths = Array.from(_getContextMap.keys());
        sortPaths(paths);
        for (const projectRoot of paths) {
            if (filePath.startsWith(projectRoot)) {
                return projectRoot;
            }
        }
    }
}

function sortPaths(paths: string[]) {
    paths.sort((a, b) => b.length - a.length);
}

function buildGetContextFunc({ info, logger, modules }: ProjectInfo & { logger: PluginLogger }): GetContextFn {
    return getContext;

    function getContext(fileName: string): PluginContext | undefined {
        const program = info.project['program'] as ts.Program | undefined;

        if (!program) {
            logger.info('getContext()', 'get program failed');
            return undefined;
        }

        const typeChecker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(fileName);

        if (!sourceFile) {
            logger.info('getContext()', 'get source file failed');
            return undefined;
        }

        return {
            program,
            typeChecker,
            sourceFile,
            ts: modules.typescript,
            logger,
        };
    }
}

function initHttpServer(resolveContext: GetContextFn) {
    const app = express();
    app.use(express.json());

    app.get('/ng-helper/hc', (_, res) => res.send());

    app.post('/ng-helper/component/controller-as', (req, res) => {
        handleRequest<NgRequest, string | undefined>({ req, res, resolveContext, action: (ctx) => getComponentControllerAs(ctx) });
    });

    app.post('/ng-helper/component/completion', (req, res) => {
        handleRequest<NgCompletionRequest, NgCompletionResponse>({
            req,
            res,
            resolveContext,
            action: (ctx, body) => getComponentCompletions(ctx, body.prefix),
        });
    });

    app.post('/ng-helper/component/hover', (req, res) => {
        handleRequest<NgHoverRequest, NgHoverResponse>({
            req,
            res,
            resolveContext,
            action: (ctx, body) => getComponentHoverType(ctx, body),
        });
    });

    return app;
}

function handleRequest<TBody extends NgRequest, TResponse>({
    req,
    res,
    resolveContext,
    action,
}: {
    req: express.Request<unknown, unknown, TBody>;
    res: express.Response<TResponse>;
    resolveContext: GetContextFn;
    action: (ctx: PluginContext, body: TBody) => TResponse;
}) {
    const body = req.body;
    const ctx = resolveContext(body.fileName);
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
