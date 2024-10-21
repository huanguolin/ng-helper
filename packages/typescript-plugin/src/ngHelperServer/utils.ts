import type { CorePluginContext, PluginContext } from '../type';

export function getCtxOfCoreCtx(coreCtx: CorePluginContext, filePath: string): PluginContext | undefined {
    const sourceFile = coreCtx.program.getSourceFile(filePath);
    if (!sourceFile) {
        coreCtx.logger.info('getContextOfCoreCtx()', 'get source file failed');
        return;
    }

    return Object.assign({ sourceFile }, coreCtx);
}
