import * as http from 'http';

import { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import express from 'express';
import type ts from 'typescript/lib/tsserverlibrary';

import { CorePluginContext, GetCoreContextFn, NgHelperServer, PluginContext, PluginLogger, ProjectInfo } from '../type';
import { buildLogger } from '../utils/log';

import { configApi } from './configApi';
import { buildCache, type NgCache } from './ngCache';
import { getCtxOfCoreCtx } from './utils';

export const ngHelperServer = createNgHelperServer();

function createNgHelperServer(): NgHelperServer {
    const _express = initHttpServer();
    let _httpServer: http.Server | undefined;
    let _config: Partial<NgPluginConfiguration> | undefined;

    const _getContextMap = new Map<string, GetCoreContextFn>();
    const _cacheMap = new Map<string, NgCache>();

    return {
        isExtensionActivated,
        getConfig,
        updateConfig,
        addProject,
        getContext,
        getCoreContext,
        getCache,
    };

    function isExtensionActivated() {
        return !!_config?.port;
    }

    function getConfig() {
        return _config;
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

    function addProject(projectInfo: ProjectInfo): () => void {
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
        _cacheMap.set(projectRoot, buildCache(getCoreContext));

        initLogger.info('end with projectRoot:', projectRoot);
        initLogger.endGroup();

        return removeProject;

        function removeProject() {
            if (projectRoot) {
                _getContextMap.delete(projectRoot);
                _cacheMap.delete(projectRoot);

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

    function getCache(filePath: string): NgCache | undefined {
        const projectRoot = getProjectRoot(filePath);
        if (!projectRoot) {
            return;
        }

        return _cacheMap.get(projectRoot);
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

    configApi(app);

    return app;
}
