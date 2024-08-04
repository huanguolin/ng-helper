import { SPACE } from '@ng-helper/shared/lib/html';
import {
    NgComponentNameInfo,
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgTypeInfo,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, NgComponentTypeInfo, PluginContext } from '../type';
import { getPropertyType, getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import { getComponentTypeInfo, getComponentDeclareLiteralNode, getPublicMembersTypeInfoOfBindings, getControllerType } from '../utils/ng';

import { beautifyTypeString, buildHoverInfo, getMinSyntaxNodeForHover } from './utils';

export function getComponentNameOrAttrNameHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameHoverRequest,
): NgHoverResponse {
    ngHelperServer.refreshInternalMaps(fileName);

    const componentMap = ngHelperServer.getComponentMap(fileName);
    if (!componentMap) {
        return;
    }

    let componentFilePath: string | undefined;
    let componentFileInfo: NgComponentNameInfo | undefined;
    for (const [key, value] of componentMap.entries()) {
        if (value.componentName === hoverInfo.tagName) {
            componentFilePath = key;
            componentFileInfo = value;
            break;
        }
    }

    if (!componentFilePath || !componentFileInfo) {
        if (hoverInfo.type === 'tagName') {
            // TODO transclude 处理
        }
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, componentFilePath);
    if (!ctx) {
        return;
    }

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    const attrsFromBindings = getPublicMembersTypeInfoOfBindings(ctx, info.bindings, false);
    if (!attrsFromBindings) {
        return;
    }

    let attrsFromType: NgTypeInfo[] = [];
    if (info.controllerType) {
        attrsFromType = getPublicMembersTypeInfoOfType(ctx, info.controllerType) ?? [];
    }

    const attrTypeMap = new Map<string, NgTypeInfo>(attrsFromType.map((x) => [x.name, x]));
    if (hoverInfo.type === 'tagName') {
        const bindings = attrsFromBindings
            .map(
                (x) =>
                    `${SPACE.repeat(4)}${x.name}: ${x.document.split(':').pop()?.trim()}; ${attrTypeMap.has(x.name) ? '// ' + attrTypeMap.get(x.name)!.typeString : ''}`,
            )
            .join('\n');
        let transclude = '';
        if (componentFileInfo.transclude) {
            if (Array.isArray(componentFileInfo.transclude) && componentFileInfo.transclude.length) {
                // TODO transclude 信息
            } else {
                transclude = `transclude: true`;
            }
        }
        return {
            formattedTypeString: [`(component) ${hoverInfo.tagName}`, `bindings: {\n${bindings}\n}`, transclude].filter((x) => !!x).join('\n'),
            document: '',
        };
    } else {
        const attrBindingsMap = new Map<string, NgTypeInfo>(attrsFromBindings.map((x) => [x.name, x]));
        const result = {
            formattedTypeString: `(property) ${hoverInfo.name}: any`,
            document: '',
        };

        if (attrBindingsMap.has(hoverInfo.name)) {
            result.document = '' + attrBindingsMap.get(hoverInfo.name)!.document;
        }

        if (attrTypeMap.has(hoverInfo.name)) {
            const typeInfo = attrTypeMap.get(hoverInfo.name)!;
            result.formattedTypeString = `(property) ${hoverInfo.name}: ${beautifyTypeString(typeInfo.typeString)}`;
            if (typeInfo.document) {
                result.document += `\n${typeInfo.document}`;
            }
        } else if (attrBindingsMap.has(hoverInfo.name)) {
            result.formattedTypeString = `(property) ${hoverInfo.name}: ${beautifyTypeString(attrBindingsMap.get(hoverInfo.name)!.typeString)}`;
        }

        return result;
    }
}

export function getComponentTypeHoverInfo(ctx: PluginContext, { contextString, cursorAt }: NgHoverRequest): NgHoverResponse {
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
        return getHoverInfoOfType({
            ctx,
            controllerType: info.controllerType,
            controllerAs: info.controllerAs,
            contextString,
            targetNode,
            minSyntaxSourceFile: sourceFile,
        });
    }

    if (info.bindings.size > 0) {
        return getHoverInfoOfBindings(ctx, info, targetNode.text);
    }
}

export function getControllerTypeHoverInfo(
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

    const controllerType = getControllerType(ctx);
    if (!controllerType) {
        logger.info('controllerType not found!');
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
    if ((!minPrefix.startsWith(controllerAs) && minPrefix !== controllerName) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    if (minPrefix === controllerName) {
        controllerAs = controllerName;
    }

    return getHoverInfoOfType({
        ctx,
        controllerType: controllerType,
        controllerAs,
        contextString,
        targetNode,
        minSyntaxSourceFile: sourceFile,
    });
}

function getHoverInfoOfType({
    ctx,
    controllerType,
    controllerAs,
    contextString,
    targetNode,
    minSyntaxSourceFile,
}: {
    ctx: PluginContext;
    controllerType: ts.Type;
    controllerAs: string;
    contextString: string;
    targetNode: ts.Identifier;
    minSyntaxSourceFile: ts.SourceFile;
}): NgHoverResponse {
    const logger = ctx.logger.prefix('getHoverInfoForType()');

    // hover 在跟节点上
    if (targetNode.text === controllerAs) {
        logger.info('targetType:', typeToString(ctx, controllerType));
        return buildHoverInfo({ ctx, targetType: controllerType, name: targetNode.text });
    }

    // hover 在后代节点上, 取父节点的类型(目的是需要通过它获取关联的文档)，然后再取目标节点类型
    const prefixContextString = contextString.slice(0, targetNode.getStart(minSyntaxSourceFile));
    const prefixMinSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefixContextString)!;
    const parentType = getNodeType(ctx, controllerType, prefixMinSyntaxNode);
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

function getHoverInfoOfBindings(ctx: PluginContext, info: NgComponentTypeInfo, targetPropName: string): NgHoverResponse {
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
