import { NgTypeCompletionResponse, NgComponentNameInfo, NgTypeInfo, NgComponentNameCompletionResponse } from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, NgComponentFileInfo, PluginContext } from '../type';
import { getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import { getPublicMembersTypeInfoOfBindings } from '../utils/ng';
import { getComponentTypeInfo } from '../utils/ng';
import { getComponentDeclareLiteralNode } from '../utils/ng';

import { getMinSyntaxNodeForCompletion, getCompletionType, rebuildAllComponentFileInfo } from './utils';

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    return info.controllerAs;
}

export function getComponentCompletions(ctx: PluginContext, prefix: string): NgTypeCompletionResponse {
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

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
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

export function getComponentNameCompletions(coreCtx: CorePluginContext, filePath: string): NgComponentNameCompletionResponse {
    const componentMap = refreshComponentFileMap(coreCtx, filePath);
    return componentMap ? Array.from(componentMap.values()) : undefined;
}

export function getComponentAttrCompletions(coreCtx: CorePluginContext, filePath: string, componentName: string): NgTypeInfo[] | undefined {
    const componentMap = refreshComponentFileMap(coreCtx, filePath);
    if (!componentMap) {
        return;
    }

    let componentFilePath: string | undefined;
    let componentFileInfo: NgComponentNameInfo | undefined;
    for (const [key, value] of componentMap.entries()) {
        if (value.componentName === componentName) {
            componentFilePath = key;
            componentFileInfo = value;
            break;
        }
    }

    if (!componentFilePath || !componentFileInfo) {
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
    const attrs = getPublicMembersTypeInfoOfBindings(ctx, info.bindings, true);
    if (!info.controllerType) {
        return attrs;
    }

    const props = getPublicMembersTypeInfoOfType(ctx, info.controllerType);
    return mergeTypeInfo(attrs, props);

    function mergeTypeInfo(attrs: NgTypeInfo[] | undefined, props: NgTypeInfo[] | undefined): NgTypeInfo[] | undefined {
        if (!attrs && !props) {
            return;
        }

        if (!attrs) {
            return props;
        }

        if (!props) {
            return attrs;
        }

        const propMap = new Map(props.map((x) => [x.name, x]));
        for (const attr of attrs) {
            attr.kind = 'property';
            const prop = propMap.get(attr.name);
            if (prop) {
                attr.isFunction = prop.isFunction;
                attr.typeString = prop.typeString;
                attr.document = [attr.document, prop.document].filter((x) => !!x).join('\n\n');
            }
        }
        return attrs;
    }
}

function refreshComponentFileMap(coreCtx: CorePluginContext, filePath: string): Map<string, NgComponentFileInfo> | undefined {
    const oldComponentMap = ngHelperServer.getComponentMap(filePath);
    if (!oldComponentMap) {
        return;
    }

    const newComponentMap = rebuildAllComponentFileInfo(coreCtx, oldComponentMap);
    ngHelperServer.updateComponentMap(filePath, newComponentMap);

    return newComponentMap;
}
