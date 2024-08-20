import {
    NgTypeCompletionResponse,
    NgComponentNameInfo,
    NgTypeInfo,
    NgComponentNameCompletionResponse,
    NgCtrlTypeCompletionRequest,
} from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, NgTsCtrlFileInfo, PluginContext } from '../type';
import { getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import { getControllerType, getPublicMembersTypeInfoOfBindings } from '../utils/ng';
import { getComponentTypeInfo } from '../utils/ng';
import { getComponentDeclareLiteralNode } from '../utils/ng';

import { getMinSyntaxNodeForCompletion, getNodeType } from './utils';

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    return info.controllerAs;
}

export function getComponentTypeCompletions(ctx: PluginContext, prefix: string): NgTypeCompletionResponse {
    const logger = ctx.logger.prefix('getComponentCompletions()');

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx);
    if (!componentLiteralNode) {
        logger.info('componentLiteralNode not found!');
        return;
    }

    const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefix);
    const minPrefix = minSyntaxNode?.minNode.getText(minSyntaxNode?.sourceFile);
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
        const targetType = getNodeType(ctx, info.controllerType, minSyntaxNode);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return getPublicMembersTypeInfoOfType(ctx, targetType);
    }
}

export function getControllerTypeCompletions(coreCtx: CorePluginContext, info: NgCtrlTypeCompletionRequest): NgTypeCompletionResponse {
    const logger = coreCtx.logger.prefix('getControllerTypeCompletions()');

    if (!info.controllerAs) {
        logger.info('controllerAs not found!');
        return;
    }

    const ctx = resolveCtrlCtx(coreCtx, info.fileName, info.controllerName);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, info.prefix);
    const minPrefix = minSyntaxNode?.minNode.getText(minSyntaxNode?.sourceFile);
    logger.info('minPrefix:', minPrefix);
    if (!minSyntaxNode || !minPrefix || !minPrefix.startsWith(info.controllerAs)) {
        return;
    }

    const ctrlType = getControllerType(ctx);
    if (!ctrlType) {
        logger.info('ctrlType not found!');
        return;
    }

    // ctrl. 的情况
    if (minPrefix === info.controllerAs + '.') {
        return getPublicMembersTypeInfoOfType(ctx, ctrlType);
    }

    const targetType = getNodeType(ctx, ctrlType, minSyntaxNode);
    logger.info('targetType:', typeToString(ctx, targetType));
    if (!targetType) {
        return;
    }

    return getPublicMembersTypeInfoOfType(ctx, targetType);
}

export function getComponentNameCompletions(coreCtx: CorePluginContext, filePath: string): NgComponentNameCompletionResponse {
    ngHelperServer.refreshInternalMaps(filePath);
    const componentMap = ngHelperServer.getComponentMap(filePath);
    return componentMap ? Array.from(componentMap.values()) : undefined;
}

export function getComponentAttrCompletions(coreCtx: CorePluginContext, filePath: string, componentName: string): NgTypeInfo[] | undefined {
    ngHelperServer.refreshInternalMaps(filePath);
    const componentMap = ngHelperServer.getComponentMap(filePath);
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

    const componentTypeInfo = getComponentTypeInfo(ctx, componentLiteralNode);
    const typeFromBindings = getPublicMembersTypeInfoOfBindings(ctx, componentTypeInfo.bindings, true);
    if (!componentTypeInfo.controllerType) {
        return typeFromBindings;
    }

    const typeFromProps = getPublicMembersTypeInfoOfType(ctx, componentTypeInfo.controllerType);
    return mergeTypeInfo(typeFromBindings, typeFromProps, getToPropsNameMap(componentTypeInfo.bindings));

    function mergeTypeInfo(
        typeFromBindings: NgTypeInfo[] | undefined,
        typeFromProps: NgTypeInfo[] | undefined,
        toPropsNameMap: Map<string, string>,
    ): NgTypeInfo[] | undefined {
        if (!typeFromBindings && !typeFromProps) {
            return;
        }

        if (!typeFromBindings) {
            return typeFromProps;
        }

        if (!typeFromProps) {
            return typeFromBindings;
        }

        const propMap = new Map(typeFromProps.map((x) => [x.name, x]));
        for (const p of typeFromBindings) {
            p.kind = 'property';
            const prop = propMap.get(toPropsNameMap.get(p.name)!);
            if (prop) {
                p.isFunction = prop.isFunction;
                p.typeString = prop.typeString;
                p.document = [p.document, prop.document].filter((x) => !!x).join('\n\n');
            }
        }
        return typeFromBindings;
    }

    function getToPropsNameMap(bindingsMap: Map<string, string>): Map<string, string> {
        const result = new Map<string, string>();
        for (const [k, v] of bindingsMap) {
            const inputName = v.replace(/[@=<?&]/g, '').trim();
            result.set(inputName || k, k);
        }
        return result;
    }
}

export function resolveCtrlCtx(coreCtx: CorePluginContext, fileName: string, controllerName: string): PluginContext | undefined {
    const logger = coreCtx.logger.prefix('resolveCtrlCtx()');

    const map = ngHelperServer.getTsCtrlMap(fileName);
    if (!map) {
        logger.info('tsCtrlMap not found!');
        return;
    }

    let tsCtrlFilePath = getTsCtrlFilePath(map);
    if (!tsCtrlFilePath) {
        // lazy refresh
        ngHelperServer.refreshInternalMaps(fileName);
        // get again
        tsCtrlFilePath = getTsCtrlFilePath(ngHelperServer.getTsCtrlMap(fileName)!);
        if (!tsCtrlFilePath) {
            logger.info('tsCtrlFilePath not found!');
            return;
        }
    }
    logger.info('tsCtrlFilePath:', tsCtrlFilePath);

    const ctx = getCtxOfCoreCtx(coreCtx, tsCtrlFilePath);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    return ctx;

    function getTsCtrlFilePath(map: Map<string, NgTsCtrlFileInfo>) {
        let tsCtrlFilePath: string | undefined;
        for (const [k, v] of map.entries()) {
            if (v.controllerName === controllerName) {
                tsCtrlFilePath = k;
                break;
            }
        }
        return tsCtrlFilePath;
    }
}
