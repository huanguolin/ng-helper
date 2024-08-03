import { NgCtrlHoverRequest, NgHoverRequest, NgHoverResponse } from '@ng-helper/shared/lib/plugin';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { CorePluginContext, NgComponentTypeInfo, PluginContext } from '../type';
import { getPropertyType, typeToString } from '../utils/common';
import { getComponentTypeInfo, getComponentDeclareLiteralNode, getPublicMembersTypeInfoOfBindings, getControllerType } from '../utils/ng';

import { beautifyTypeString, buildHoverInfo, getMinSyntaxNodeForHover } from './utils';

export function getComponentHoverType(ctx: PluginContext, { contextString, cursorAt }: NgHoverRequest): NgHoverResponse {
    const logger = ctx.logger.prefix('getComponentHoverType()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        logger.info('componentLiteralNode not found!');
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    logger.info('controllerType:', typeToString(ctx, info.controllerType), 'controllerAs:', info.controllerAs);
    if (!info.controllerType && !info.bindings.size) {
        return;
    }

    const minSyntax = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
    if (!minSyntax) {
        logger.info('minSyntax not found!');
        return;
    }

    const { sourceFile, minNode, targetNode } = minSyntax;
    const minPrefix = minNode.getText(sourceFile);
    logger.info('minPrefix:', minPrefix, 'targetNode:', targetNode.getText(sourceFile));
    if (!minPrefix.startsWith(info.controllerAs) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    if (info.controllerType) {
        // hover 在跟节点上
        if (targetNode.text === info.controllerAs) {
            logger.info('targetType:', typeToString(ctx, info.controllerType));
            return buildHoverInfo({ ctx, targetType: info.controllerType, name: targetNode.text });
        }

        // hover 在后代节点上, 取父节点的类型(目的是需要通过它获取关联的文档)，然后再取目标节点类型
        const prefixContextString = contextString.slice(0, targetNode.getStart(sourceFile));
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
        return getHoverInfoForBindings(ctx, info, targetNode.text);
    }
}

function getHoverInfoForBindings(ctx: PluginContext, info: NgComponentTypeInfo, targetPropName: string): NgHoverResponse {
    const bindingTypes = getPublicMembersTypeInfoOfBindings(ctx, info.bindings)!;

    // hover 在跟节点上
    if (targetPropName === info.controllerAs) {
        const typeString =
            '{ ' +
            bindingTypes.reduce((acc, cur) => {
                const s = `${cur.name}: ${cur.typeString};`;
                return acc ? `${acc} ${s}` : s;
            }, '') +
            ' }';
        return {
            formattedTypeString: `(object) ${targetPropName}: ${beautifyTypeString(typeString)}`,
            document: '',
        };
    }

    const targetType = bindingTypes.find((t) => t.name === targetPropName);
    if (targetType) {
        return {
            formattedTypeString: `(property) ${targetPropName}: ${beautifyTypeString(targetType.typeString)}`,
            document: targetType.document,
        };
    } else {
        return {
            formattedTypeString: `(property) ${targetPropName}: any`,
            document: '',
        };
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

    const ctrlType = getControllerType(ctx);
    if (!ctrlType) {
        logger.info('ctrlType not found!');
        return;
    }

    const minSyntax = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
    if (!minSyntax) {
        logger.info('minSyntax not found!');
        return;
    }

    const { sourceFile, minNode, targetNode } = minSyntax;
    const minPrefix = minNode.getText(sourceFile);
    logger.info('minPrefix:', minPrefix, 'targetNode:', targetNode.getText(sourceFile));
    if (!minPrefix.startsWith(controllerAs) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    // hover 在跟节点上
    if (targetNode.text === controllerAs) {
        logger.info('targetType:', typeToString(ctx, ctrlType));
        return buildHoverInfo({ ctx: ctx, targetType: ctrlType, name: targetNode.text });
    }

    // hover 在后代节点上, 取父节点的类型，然后在取目标节点类型
    const prefixContextString = contextString.slice(0, targetNode.getStart(sourceFile));
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
