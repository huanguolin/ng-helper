import {
    NgTypeCompletionResponse,
    NgComponentNameInfo,
    NgTypeInfo,
    NgComponentNameCompletionResponse,
    NgCtrlTypeCompletionRequest,
    type NgDirectiveNameInfo,
    type NgComponentAttrCompletionResponse,
    type NgDirectiveCompletionResponse,
    type NgDirectiveCompletionRequest,
} from '@ng-helper/shared/lib/plugin';

import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, NgTsCtrlFileInfo, PluginContext } from '../type';
import { findMatchedDirectives, findUnmatchedDirectives, getTypeInfosFromDirectiveScope, type DirectiveFileInfo } from '../utils/biz';
import { getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import {
    getControllerType,
    getDirectiveConfigNode,
    getObjLiteral,
    getPropValueByName,
    getPublicMembersTypeInfoOfBindings,
    isElementDirective,
    removeBindingControlChars,
} from '../utils/ng';
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
    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(filePath);
    if (!componentDirectiveMap) {
        return;
    }

    const result: NgComponentNameInfo[] = [];
    for (const item of componentDirectiveMap.values()) {
        if (item.components.length) {
            result.push(...item.components);
        }
        if (item.directives.length) {
            const asComponents = item.directives
                .filter((x) => isElementDirective(x))
                .map((x) => ({
                    componentName: x.directiveName,
                    transclude: x.transclude,
                }));
            result.push(...asComponents);
        }
    }
    return result;
}

export function getComponentAttrCompletions(coreCtx: CorePluginContext, filePath: string, componentName: string): NgComponentAttrCompletionResponse {
    ngHelperServer.refreshInternalMaps(filePath);

    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(filePath);
    if (!componentDirectiveMap) {
        return;
    }

    for (const [key, value] of componentDirectiveMap.entries()) {
        const component = value.components.find((x) => x.componentName === componentName);
        if (component) {
            return getComponentAttrCompletionsViaComponentFileInfo(coreCtx, key, component);
        }

        const directive = value.directives.find((x) => isElementDirective(x) && x.directiveName === componentName);
        if (directive) {
            return getComponentAttrCompletionsViaDirectiveFileInfo(coreCtx, key, directive);
        }
    }
}

function getComponentAttrCompletionsViaDirectiveFileInfo(
    coreCtx: CorePluginContext,
    filePath: string,
    directiveNameInfo: NgDirectiveNameInfo,
): NgTypeInfo[] | undefined {
    if (!filePath || !directiveNameInfo) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, filePath);
    if (!ctx) {
        return;
    }

    const directiveConfigNode = getDirectiveConfigNode(ctx, directiveNameInfo.directiveName);
    if (!directiveConfigNode) {
        return;
    }

    const scopePropertyValue = getPropValueByName(ctx, directiveConfigNode, 'scope');
    if (!scopePropertyValue || !ctx.ts.isObjectLiteralExpression(scopePropertyValue)) {
        return;
    }

    const obj = getObjLiteral(ctx, scopePropertyValue);
    const map = new Map<string, string>(Object.entries(obj));
    return getPublicMembersTypeInfoOfBindings(ctx, map, true);
}

function getComponentAttrCompletionsViaComponentFileInfo(
    coreCtx: CorePluginContext,
    filePath: string,
    componentNameInfo: NgComponentNameInfo,
): NgTypeInfo[] | undefined {
    const logger = coreCtx.logger.prefix('getComponentAttrCompletionsViaComponentFileInfo()');

    if (!filePath || !componentNameInfo) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, filePath);
    if (!ctx) {
        return;
    }

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx, componentNameInfo.componentName);
    if (!componentLiteralNode) {
        return;
    }

    const componentTypeInfo = getComponentTypeInfo(ctx, componentLiteralNode);
    logger.info('componentTypeInfo.bindings.keys:', Array.from(componentTypeInfo.bindings.keys()));
    const typeFromBindings = getPublicMembersTypeInfoOfBindings(ctx, componentTypeInfo.bindings, true);
    if (!typeFromBindings || !componentTypeInfo.controllerType) {
        return typeFromBindings;
    }

    const typeFromProps = getPublicMembersTypeInfoOfType(ctx, componentTypeInfo.controllerType);
    if (!typeFromProps) {
        return typeFromBindings;
    }

    return mergeTypeInfo(typeFromBindings, typeFromProps, getToPropsNameMap(componentTypeInfo.bindings));

    function mergeTypeInfo(
        typeFromBindings: NgTypeInfo[],
        typeFromProps: NgTypeInfo[],
        toPropsNameMap: Map<string, string>,
    ): NgTypeInfo[] | undefined {
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
            const inputName = removeBindingControlChars(v).trim();
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

export function getDirectiveCompletions(coreCtx: CorePluginContext, info: NgDirectiveCompletionRequest): NgDirectiveCompletionResponse {
    ngHelperServer.refreshInternalMaps(info.fileName);

    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(info.fileName);
    if (!componentDirectiveMap) {
        return;
    }

    const matchedDirectives = findMatchedDirectives(componentDirectiveMap, info.attrNames);
    const unmatchedDirectives = findUnmatchedDirectives(componentDirectiveMap, info.attrNames);
    // TODO 要排除已经出现过的属性名
    const result = getTypeInfosFromDirectives(coreCtx, matchedDirectives);
    const unmatchedDirectiveNames: NgTypeInfo[] = unmatchedDirectives.map((directive) => ({
        kind: 'directive',
        name: directive.directiveInfo.directiveName,
        typeString: 'directive',
        document: '',
        isFunction: false,
    }));

    result.push(...unmatchedDirectiveNames);

    return result.length > 0 ? result : undefined;
}

function getTypeInfosFromDirectives(coreCtx: CorePluginContext, matchedDirectives: DirectiveFileInfo[]): NgTypeInfo[] {
    const result: NgTypeInfo[] = [];

    for (const item of matchedDirectives) {
        const typeInfos = getTypeInfosFromDirectiveScope(coreCtx, item);
        if (typeInfos) {
            result.push(...typeInfos);
        }
    }

    return result;
}
