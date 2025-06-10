import { NgPluginConfiguration, type NgRequest } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript/lib/tsserverlibrary';

import { CorePluginContext, GetCoreContextFn, NgHelperServer, PluginContext, PluginLogger, ProjectInfo } from '../type';
import { buildLogger } from '../utils/log';

import { RpcRouter } from './RpcRouter';
import { methodMapping } from './methodMapping';
import { buildCache, type NgCache } from './ngCache';
import { RpcClient } from './rpcClient';
import { getCtxOfCoreCtx } from './utils';

export const ngHelperTsService = createNgHelperTsService();

function createNgHelperTsService(): NgHelperServer {
    const _rpcClient = new RpcClient(new RpcRouter(_resolveCtx, methodMapping, _log), _log);
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

    function _resolveCtx<T extends boolean>(
        ngRequest: NgRequest,
        isCoreCtx: T,
    ): CorePluginContext | PluginContext | undefined {
        return isCoreCtx ? getCoreContext(ngRequest.fileName) : getContext(ngRequest.fileName);
    }

    function _log(msg: string, ...info: unknown[]) {
        // log record
        if (_getContextMap.size > 0) {
            const { value: getCoreContext } = _getContextMap.values().next() as {
                value: GetCoreContextFn;
                done: boolean;
            };
            getCoreContext()?.logger.info(msg, ...info);
        }
    }

    function isExtensionActivated() {
        return !!_config?.port;
    }

    function getConfig() {
        return _config;
    }

    function updateConfig(cfg: Partial<NgPluginConfiguration>) {
        if (_config?.port !== cfg.port && cfg.port) {
            _rpcClient.updateNgConfig(cfg.port);
        }

        _config = cfg;

        _log('updateConfig(): config:', cfg);
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
        _rpcClient.report('addProject', projectRoot);

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
                _rpcClient.report('removeProject', projectRoot);

                initLogger.info('dispose:', projectRoot);
                if (_getContextMap.size === 0) {
                    _rpcClient.dispose();
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
        if (Array.isArray(_config?.projectMappings)) {
            for (const { tsProjectPath, angularJsProjectPaths } of _config.projectMappings) {
                if (angularJsProjectPaths.some((p) => filePath.startsWith(p))) {
                    return tsProjectPath;
                }
            }
            return undefined;
        }

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
