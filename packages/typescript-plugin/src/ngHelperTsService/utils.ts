import type { NgPluginConfiguration } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import type { CorePluginContext, PluginContext } from '../type';

export function getCtxOfCoreCtx(coreCtx: CorePluginContext, filePath: string): PluginContext | undefined {
    const sourceFile = coreCtx.program.getSourceFile(filePath);
    if (!sourceFile) {
        coreCtx.logger.info('getContextOfCoreCtx()', 'get source file failed');
        return;
    }

    return Object.assign({ sourceFile }, coreCtx);
}

export function isAngularJsDependentTsProject(info: ts.server.PluginCreateInfo): boolean {
    const config = info.config as Partial<NgPluginConfiguration>;
    if (!Array.isArray(config.projectMappings)) {
        info.project.projectService.logger.info('-----> not get config.projectMappings');
        // 没有配置，则都是
        return true;
    }

    const tsProjectPaths = config.projectMappings.map((x) => x.tsProjectPath);
    const currentTsProjectPath = info.project.getCurrentDirectory();
    return tsProjectPaths.includes(currentTsProjectPath);
}
