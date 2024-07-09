import { NgHoverResponse } from '@ng-helper/shared/lib/plugin';

import { getCompletionType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { PluginContext } from '../type';
import { typeToString } from '../utils/common';
import { getComponentCoreInfo, getComponentDeclareLiteralNode } from '../utils/ng';

import { buildTypeInfo } from './utils';

export function getComponentHoverType(ctx: PluginContext, contextString: string): NgHoverResponse {
    const logger = ctx.logger.prefix('getComponentHoverType()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        logger.info('componentLiteralNode not found!');
        return;
    }

    const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, contextString);
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

    if (info.controllerType) {
        // TODO improve targetType & hover name
        const targetType = getCompletionType(ctx, info.controllerType, minSyntaxNode);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return buildTypeInfo({ ctx, type: targetType, name: minPrefix });
    }
}
