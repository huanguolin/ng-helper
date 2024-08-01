import { NgCtrlHoverRequest, NgHoverRequest, NgHoverResponse } from '@ng-helper/shared/lib/plugin';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { CorePluginContext, PluginContext } from '../type';
import { getNodeAtPosition, getPropertyType, typeToString } from '../utils/common';
import { getComponentTypeInfo, getComponentDeclareLiteralNode, getPublicMembersTypeInfoOfBindings, getControllerType } from '../utils/ng';

import { beautifyTypeString, buildHoverInfo, getMinSyntaxNodeForHover } from './utils';

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
    const minSyntaxNode = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
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

        // hover 在后代节点上, 取父节点的类型，然后再取目标节点类型
        const prefixContextString = contextString.slice(0, targetNode.getStart(minSyntaxNode.sourceFile));
        const prefixMinSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefixContextString)!;
        const parentType = getNodeType(ctx, info.controllerType, prefixMinSyntaxNode);
        logger.info('parentType:', typeToString(ctx, parentType));
        if (!parentType) {
            return;
        }

        const targetType = getPropertyType(ctx, parentType, targetNode.text);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return buildHoverInfo({ ctx, targetType, parentType, name: targetNode.text });
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

export function getControllerHoverType(
    coreCtx: CorePluginContext,
    { fileName, controllerName, controllerAs, contextString, cursorAt }: NgCtrlHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getControllerHoverType()');

    if (!controllerAs) {
        logger.info('controllerAs not found!');
        return;
    }

    const ctx = resolveCtrlCtx(coreCtx, fileName, controllerName);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    if (!contextString.endsWith('.')) {
        contextString += '.';
    }

    const minSyntaxNode = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
    const minPrefix = minSyntaxNode?.node.getText(minSyntaxNode?.sourceFile);
    logger.info('minPrefix:', minPrefix);
    if (!minSyntaxNode || !minPrefix || !minPrefix.startsWith(controllerAs)) {
        return;
    }

    const ctrlType = getControllerType(ctx);
    if (!ctrlType) {
        logger.info('ctrlType not found!');
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

    // hover 在跟节点上
    if (targetNode.text === controllerAs) {
        logger.info('targetType:', typeToString(ctx, ctrlType));
        return buildHoverInfo({ ctx: ctx, targetType: ctrlType, name: targetNode.text });
    }

    // hover 在后代节点上, 取父节点的类型，然后在取目标节点类型
    const prefixContextString = contextString.slice(0, targetNode.getStart(minSyntaxNode.sourceFile));
    const prefixMinSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefixContextString)!;
    const parentType = getNodeType(ctx, ctrlType, prefixMinSyntaxNode);
    logger.info('parentType:', typeToString(ctx, parentType));
    if (!parentType) {
        return;
    }

    const targetType = getPropertyType(ctx, parentType, targetNode.text);
    logger.info('targetType:', typeToString(ctx, targetType));
    if (!targetType) {
        return;
    }

    return buildHoverInfo({
        ctx,
        targetType,
        parentType,
        name: targetNode.text,
    });
}
