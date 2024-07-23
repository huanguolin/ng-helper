import { NgCompletionResponse } from '@ng-helper/shared/lib/plugin';

import { ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, PluginContext } from '../type';
import { getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import { getPublicMembersTypeInfoOfBindings, isComponentTsFile } from '../utils/ng';
import { getComponentCoreInfo } from '../utils/ng';
import { getComponentDeclareLiteralNode } from '../utils/ng';

import { getMinSyntaxNodeForCompletion, getCompletionType } from './utils';

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        return;
    }

    const info = getComponentCoreInfo(ctx, componentLiteralNode);
    return info.controllerAs;
}

export function getComponentCompletions(ctx: PluginContext, prefix: string): NgCompletionResponse {
    const logger = ctx.logger.prefix('getComponentCompletions()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        logger.info('componentLiteralNode not found!');
        return;
    }

    const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefix);
    const minPrefix = minSyntaxNode?.node.getText(minSyntaxNode?.sourceFile);
    logger.info('minPrefix:', minPrefix);
    if (!minSyntaxNode || !minPrefix) {
        return;
    }

    const info = getComponentCoreInfo(ctx, componentLiteralNode);
    logger.info('controllerType:', typeToString(ctx, info.controllerType), 'controllerAs:', info.controllerAs);
    if (!minPrefix.startsWith(info.controllerAs)) {
        return;
    }

    // ctrl. 的情况
    if (minPrefix === info.controllerAs + '.') {
        return info.controllerType
            ? getPublicMembersTypeInfoOfType(ctx, info.controllerType)
            : getPublicMembersTypeInfoOfBindings(ctx, info.bindings);
    }

    if (info.controllerType) {
        const targetType = getCompletionType(ctx, info.controllerType, minSyntaxNode);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return getPublicMembersTypeInfoOfType(ctx, targetType);
    }
}

export function updateComponentsInfo(coreCtx: CorePluginContext, filePath: string) {
    // const logger = coreCtx.logger.prefix('getComponentNameCompletions()');

    coreCtx.program.getSourceFiles().forEach((sourceFile) => {
        if (!isComponentTsFile(sourceFile.fileName) || sourceFile.fileName === filePath) {
            return;
        }

        const ctx = ngHelperServer.getContext(sourceFile.fileName);
        if (!ctx) {
            return;
        }

        const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentCoreInfo(ctx, componentLiteralNode);
    });
}
