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
        isNgHelperCanHandled,
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

    function isNgHelperCanHandled(info: ts.server.PluginCreateInfo, filePath: string) {
        // config 还没有，则还没有准备好，统一返回 false
        if (!_config || !_config.port) {
            return false;
        }

        if (!Array.isArray(_config.projectMappings)) {
            // 没有配置，则都是
            return true;
        }

        // 按照配置来决定
        const tsProjectRootPath = info.project.getCurrentDirectory();
        const projectConfig = _config.projectMappings.find((x) => x.tsProjectPath === tsProjectRootPath);
        if (!projectConfig) {
            return false;
        }
        return projectConfig.ngProjectPaths.some((p) => filePath.startsWith(p));
    }

    function getConfig() {
        return _config;
    }

    function updateConfig(cfg: Partial<NgPluginConfiguration>) {
        _log('updateConfig(): config:', cfg);

        // 注意:
        // 这里的 info.config 不一定包含 client 那边传递的配置。
        // 只有包含 client 那边的配置时，才更新 _config.
        if (cfg.port) {
            _config = cfg;
        }

        if (_config?.port !== cfg.port && cfg.port) {
            _rpcClient.updateNgConfig(cfg.port);
        }
    }

    function addProject(projectInfo: ProjectInfo): () => void {
        const { info, modules } = projectInfo;
        const logger = buildLogger(modules.typescript, info);
        const initLogger = logger.prefix('[init]');

        initLogger.startGroup();
        initLogger.info('start with info.config:', info.config);

        // 更新 config
        // 注意:
        // 这里的 info.config 不一定包含 client 那边传递的配置。
        // 具体有没有取决于 client 那边 set config 与这里执行的先后。
        updateConfig(info.config as Partial<NgPluginConfiguration>);

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
            for (const { tsProjectPath, ngProjectPaths } of _config.projectMappings) {
                if (ngProjectPaths.some((p) => filePath.startsWith(p))) {
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
