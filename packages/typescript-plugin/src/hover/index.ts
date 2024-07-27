import { NgHoverRequest, NgHoverResponse } from '@ng-helper/shared/lib/plugin';

import { getCompletionType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { PluginContext } from '../type';
import { getNodeAtPosition, getPropertyType, typeToString } from '../utils/common';
import { getComponentTypeInfo, getComponentDeclareLiteralNode, getPublicMembersTypeInfoOfBindings } from '../utils/ng';

import { beautifyTypeString, buildHoverInfo } from './utils';

export function getComponentHoverType(ctx: PluginContext, { contextString, cursorAt }: NgHoverRequest): NgHoverResponse {
    const logger = ctx.logger.prefix('getComponentHoverType()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        logger.info('componentLiteralNode not found!');
        return;
    }

    if (!contextString.endsWith('.')) {
        contextString += '.';
    }
    const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, contextString);
    const minPrefix = minSyntaxNode?.node.getText(minSyntaxNode?.sourceFile);
    logger.info('minPrefix:', minPrefix);
    if (!minSyntaxNode || !minPrefix) {
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    logger.info('controllerType:', typeToString(ctx, info.controllerType), 'controllerAs:', info.controllerAs);
    if (!minPrefix.startsWith(info.controllerAs)) {
        return;
    }

    if (!info.controllerType && !info.bindings.size) {
        return;
    }

    const targetNode = getNodeAtPosition(ctx, cursorAt, minSyntaxNode.sourceFile);
    logger.info('targetNode:', targetNode ? targetNode.getText(minSyntaxNode.sourceFile) : undefined);

    if (!targetNode) {
        logger.error('targetNode not found at', cursorAt);
        return;
    }

    if (!ctx.ts.isIdentifier(targetNode)) {
        logger.error('targetNode should be an identifier, but got: ', targetNode.getText(minSyntaxNode.sourceFile));
        return;
    }

    if (info.controllerType) {
        // hover 在跟节点上
        if (targetNode.text === info.controllerAs) {
            logger.info('targetType:', typeToString(ctx, info.controllerType));
            return buildHoverInfo({ ctx, targetType: info.controllerType, name: targetNode.text });
        }

        // hover 在后代节点上, 取父节点的类型，然后在取目标节点类型
        const prefixContextString = contextString.slice(0, targetNode.getStart(minSyntaxNode.sourceFile));
        const prefixMinSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefixContextString)!;
        const parentType = getCompletionType(ctx, info.controllerType, prefixMinSyntaxNode);
        logger.info('parentType:', typeToString(ctx, parentType));
        if (!parentType) {
            return;
        }

        return buildHoverInfo({ ctx, targetType: getPropertyType(ctx, parentType, targetNode.text)!, parentType, name: targetNode.text });
    }

    if (info.bindings.size > 0) {
        const bindingTypes = getPublicMembersTypeInfoOfBindings(ctx, info.bindings)!;

        // hover 在跟节点上
        if (targetNode.text === info.controllerAs) {
            const typeString =
                '{ ' +
                bindingTypes.reduce((acc, cur) => {
                    const s = `${cur.name}: ${cur.typeString};`;
                    return acc ? `${acc} ${s}` : s;
                }, '') +
                ' }';
            return {
                formattedTypeString: `(object) ${targetNode.text}: ${beautifyTypeString(typeString)}`,
                document: '',
            };
        }

        const targetType = bindingTypes.find((t) => t.name === targetNode.text);
        if (targetType) {
            return {
                formattedTypeString: `(property) ${targetNode.text}: ${beautifyTypeString(targetType.typeString)}`,
                document: targetType.document,
            };
        } else {
            return {
                formattedTypeString: `(property) ${targetNode.text}: any`,
                document: '',
            };
        }
    }
}
