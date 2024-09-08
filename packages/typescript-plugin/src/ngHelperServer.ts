import * as http from 'http';

import {
    NgTypeCompletionRequest,
    NgTypeCompletionResponse,
    NgHoverRequest,
    NgHoverResponse,
    NgPluginConfiguration,
    NgRequest,
    NgResponse,
    NgComponentNameCompletionResponse,
    NgComponentAttrCompletionResponse,
    NgCtrlTypeCompletionRequest,
    NgCtrlHoverRequest,
    NgComponentNameOrAttrNameHoverRequest,
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgDefinitionResponse,
    type NgComponentAttrCompletionRequest,
    type NgTypeDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgComponentsStringAttrsResponse,
    type NgListComponentsStringAttrsRequest,
} from '@ng-helper/shared/lib/plugin';
import express from 'express';
import type ts from 'typescript/lib/tsserverlibrary';

import {
    getComponentAttrCompletions,
    getComponentTypeCompletions,
    getComponentControllerAs,
    getComponentNameCompletions,
    getControllerTypeCompletions,
} from './completion';
import { getComponentNameOrAttrNameDefinitionInfo, getComponentTypeDefinitionInfo, getControllerTypeDefinitionInfo } from './definition';
import { getComponentNameOrAttrNameHoverInfo, getComponentTypeHoverInfo, getControllerTypeHoverInfo } from './hover';
import { getComponentsStringAttrsInfo } from './other';
import {
    CorePluginContext,
    GetCoreContextFn,
    NgComponentFileInfo,
    NgHelperServer,
    NgTsCtrlFileInfo,
    PluginContext,
    PluginCoreLogger,
    PluginLogger,
    ProjectInfo,
} from './type';
import { getSourceFileVersion } from './utils/common';
import { buildLogger } from './utils/log';
import { getComponentNameInfo, getControllerNameInfo, isComponentTsFile, isControllerTsFile } from './utils/ng';

export const ngHelperServer = createNgHelperServer();

function createNgHelperServer(): NgHelperServer {
    const _express = initHttpServer();
    const _getContextMap = new Map<string, GetCoreContextFn>();
    const _componentMapOfMap = new Map<string, Map<string, NgComponentFileInfo>>();
    const _tsCtrlMapOfMap = new Map<string, Map<string, NgTsCtrlFileInfo>>();
    let _httpServer: http.Server | undefined;
    let _config: Partial<NgPluginConfiguration> | undefined;

    return {
        isExtensionActivated,
        updateConfig,
        addProject,
        getContext,
        getCoreContext,
        getComponentMap,
        getTsCtrlMap,
        refreshInternalMaps,
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
                _componentMapOfMap.delete(projectRoot);
                _tsCtrlMapOfMap.delete(projectRoot);

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

        return getCtxOfCoreCtx(coreCtx, filePath);
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

    function getComponentMap(filePath: string): Map<string, NgComponentFileInfo> | undefined {
        const projectRoot = getProjectRoot(filePath);
        if (!projectRoot) {
            return;
        }
        return getMap(projectRoot, _componentMapOfMap);
    }

    function getTsCtrlMap(filePath: string): Map<string, NgTsCtrlFileInfo> | undefined {
        const projectRoot = getProjectRoot(filePath);
        if (!projectRoot) {
            return;
        }
        return getMap(projectRoot, _tsCtrlMapOfMap);
    }

    function refreshInternalMaps(filePath: string): void {
        const projectRoot = getProjectRoot(filePath);
        if (!projectRoot) {
            return;
        }

        const get = <T>(mapOfMap: Map<string, T>): T => getMap(projectRoot, mapOfMap);
        const set = <T>(mapOfMap: Map<string, T>, map: T): void => setMap(projectRoot, mapOfMap, map);

        const coreCtx = getCoreContext(filePath)!;

        const start = Date.now();
        const logger = coreCtx.logger.prefix('refreshInternalMaps()');
        logger.startGroup();

        const oldComponentMap = get(_componentMapOfMap);
        const oldTsCtrlMap = get(_tsCtrlMapOfMap);
        const sourceFiles = coreCtx.program.getSourceFiles();
        logger.info('sourceFiles count:', sourceFiles.length, 'old component count:', oldComponentMap.size, 'old TsCtrl count:', oldTsCtrlMap.size);

        const newComponentMap = new Map<string, NgComponentFileInfo>();
        const newTsCtrlMap = new Map<string, NgTsCtrlFileInfo>();

        sourceFiles.forEach((sourceFile) => {
            if (isComponentTsFile(sourceFile.fileName)) {
                fillNewComponentMap({ logger, oldMap: oldComponentMap, newMap: newComponentMap, sourceFile, coreCtx });
            } else if (isControllerTsFile(sourceFile.fileName)) {
                fillNewTsCtrlMap({ logger, oldMap: oldTsCtrlMap, newMap: newTsCtrlMap, sourceFile, coreCtx });
            }
        });

        set(_componentMapOfMap, newComponentMap);
        set(_tsCtrlMapOfMap, newTsCtrlMap);

        const end = Date.now();
        logger.info('new component count:', newComponentMap.size, 'new TsCtrl count:', newTsCtrlMap.size, 'cost:', `${end - start}ms`);
        logger.endGroup();
    }

    function getMap<T>(projectRoot: string, mapOfMap: Map<string, T>): T {
        let map = mapOfMap.get(projectRoot);
        if (!map) {
            map = new Map() as T;
        }
        return map;
    }

    function setMap<T>(projectRoot: string, mapOfMap: Map<string, T>, map: T): void {
        mapOfMap.set(projectRoot, map);
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

    app.get('/ng-helper/hc', (_, res) => res.send('ok'));

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

    app.post('/ng-helper/controller/type/completion', (req, res) => {
        handleRequestWithCoreCtx<NgCtrlTypeCompletionRequest, NgTypeCompletionResponse>({
            req,
            res,
            action: (coreCtx, body) => getControllerTypeCompletions(coreCtx, body),
        });
    });

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

    return app;
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

function fillNewComponentMap({
    logger,
    oldMap,
    newMap,
    sourceFile,
    coreCtx,
}: {
    oldMap: Map<string, NgComponentFileInfo>;
    newMap: Map<string, NgComponentFileInfo>;
    sourceFile: ts.SourceFile;
    logger: PluginCoreLogger;
    coreCtx: CorePluginContext;
}): void {
    logger.info('component ts file:', sourceFile.fileName);

    const oldComponentFile = oldMap.get(sourceFile.fileName);
    const version = getSourceFileVersion(sourceFile);
    if (oldComponentFile && oldComponentFile.version === version) {
        newMap.set(sourceFile.fileName, oldComponentFile);
        logger.info('component ts file:', sourceFile.fileName, ', version not change.');
        return;
    }

    const ctx = Object.assign({ sourceFile }, coreCtx);

    const componentNameInfo = getComponentNameInfo(ctx);
    logger.info('component ts file:', sourceFile.fileName, ', componentNameInfo:', componentNameInfo);
    if (!componentNameInfo) {
        return;
    }

    newMap.set(sourceFile.fileName, {
        version,
        ...componentNameInfo,
    });
}

function fillNewTsCtrlMap({
    logger,
    oldMap,
    newMap,
    sourceFile,
    coreCtx,
}: {
    oldMap: Map<string, NgTsCtrlFileInfo>;
    newMap: Map<string, NgTsCtrlFileInfo>;
    sourceFile: ts.SourceFile;
    logger: PluginCoreLogger;
    coreCtx: CorePluginContext;
}): void {
    logger.info('controller ts file:', sourceFile.fileName);

    const oldTsCtrlFile = oldMap.get(sourceFile.fileName);
    const version = getSourceFileVersion(sourceFile);
    if (oldTsCtrlFile && oldTsCtrlFile.version === version) {
        newMap.set(sourceFile.fileName, oldTsCtrlFile);
        logger.info('controller ts file:', sourceFile.fileName, ', version not change.');
        return;
    }

    const ctx = Object.assign({ sourceFile }, coreCtx);

    const controllerName = getControllerNameInfo(ctx);
    logger.info('controller ts file:', sourceFile.fileName, ', controller name:', controllerName);
    if (!controllerName) {
        return;
    }

    newMap.set(sourceFile.fileName, {
        version,
        controllerName,
    });
}

export function getCtxOfCoreCtx(coreCtx: CorePluginContext, filePath: string): PluginContext | undefined {
    const sourceFile = coreCtx.program.getSourceFile(filePath);
    if (!sourceFile) {
        coreCtx.logger.info('getContextOfCoreCtx()', 'get source file failed');
        return;
    }

    return Object.assign({ sourceFile }, coreCtx);
}
