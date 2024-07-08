import { NgHoverResponse, NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { getCompletionType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { PluginContext } from '../type';
import { typeToString } from '../utils/common';
import { getComponentCoreInfo, getComponentDeclareLiteralNode } from '../utils/ng';

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
        const targetType = getCompletionType(ctx, info.controllerType, minSyntaxNode);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return buildTypeInfo({ ctx, type: targetType, name: '' });
    }
}

export function buildTypeInfo({ ctx, type, name }: { ctx: PluginContext; type: ts.Type; name: string }): NgTypeInfo {
    const result: NgTypeInfo = {
        name,
        kind: 'property',
        typeString: ctx.typeChecker.typeToString(type),
        document: '',
    };

    let paramNames: string[] = [];
    let returnType = 'unknown';
    const signatures = type.getCallSignatures();
    if (signatures.length > 0) {
        const signature = signatures[0];
        paramNames = signature.parameters.map((x) => x.getName());
        returnType = ctx.typeChecker.typeToString(signature.getReturnType());
    }
    return {
        ...result,
        kind: 'method',
        paramNames,
        returnType,
    };
}
