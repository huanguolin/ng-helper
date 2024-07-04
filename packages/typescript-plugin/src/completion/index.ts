import { NgCompletionResponse } from '@ng-helper/shared/lib/plugin';

import { PluginContext } from '../type';
import { getPublicMembersTypeInfoOfType } from '../utils/common';
import { getPublicMembersTypeInfoOfBindings } from '../utils/component';
import { getComponentCoreInfo } from '../utils/component';
import { getComponentDeclareLiteralNode } from '../utils/component';
import { buildLogMsg } from '../utils/log';

import { getMinSyntaxNodeForCompletion, getCompletionType } from './utils';

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentCoreInfo(ctx, componentLiteralNode);
        return info.controllerAs;
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentControllerAs error:', (error as Error).message, (error as Error).stack));
    }
}

export function getComponentCompletions(ctx: PluginContext, prefix: string): NgCompletionResponse {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefix);
        if (!minSyntaxNode) {
            ctx.logger.info(buildLogMsg('getComponentCompletions minSyntaxNode not found'));
            return;
        }

        const minPrefix = minSyntaxNode.node.getText(minSyntaxNode.sourceFile);
        ctx.logger.info(buildLogMsg('getComponentCompletions minPrefix:', minPrefix));
        const info = getComponentCoreInfo(ctx, componentLiteralNode);
        if (!minPrefix.startsWith(info.controllerAs)) {
            return;
        }

        ctx.logger.info(buildLogMsg('getComponentCompletions minPrefix:', minPrefix));

        // ctrl. 的情况
        if (minPrefix === info.controllerAs + '.') {
            ctx.logger.info(buildLogMsg('getComponentCompletions ctrl.'));
            return info.controllerType
                ? getPublicMembersTypeInfoOfType(ctx, info.controllerType)
                : getPublicMembersTypeInfoOfBindings(ctx, info.bindings);
        }

        ctx.logger.info(buildLogMsg('getComponentCompletions using getCompletionType'));
        if (info.controllerType) {
            ctx.logger.info(buildLogMsg('getComponentCompletions controllerType:', ctx.typeChecker.typeToString(info.controllerType)));
            const targetType = getCompletionType(ctx, info.controllerType, minSyntaxNode);
            if (!targetType) {
                return;
            }

            ctx.logger.info(buildLogMsg('getComponentCompletions getCompletionType targetType:', ctx.typeChecker.typeToString(targetType)));
            return getPublicMembersTypeInfoOfType(ctx, targetType);
        }
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentCompletions error:', (error as Error).message, (error as Error).stack));
    }
}
