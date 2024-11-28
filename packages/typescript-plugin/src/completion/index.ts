import {
    NgTypeCompletionResponse,
    NgTypeInfo,
    NgComponentNameCompletionResponse,
    NgCtrlTypeCompletionRequest,
    type NgComponentAttrCompletionResponse,
    type NgDirectiveCompletionResponse,
    type NgDirectiveCompletionRequest,
    type NgRequest,
} from '@ng-helper/shared/lib/plugin';

import { ngHelperServer } from '../ngHelperServer';
import type { ComponentInfo, DirectiveInfo, Property } from '../ngHelperServer/ngCache';
import { getCtxOfCoreCtx } from '../ngHelperServer/utils';
import { CorePluginContext, PluginContext } from '../type';
import { findMatchedDirectives, getDirectivesUsableAsAttributes, getTypeInfosFromDirectiveScope } from '../utils/biz';
import { formatParameters, getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import {
    getBindingName,
    getComponentControllerType,
    getControllerType,
    getPublicMembersTypeInfoOfBindings,
    isElementDirective,
} from '../utils/ng';

import { getExpressionSyntaxNode, getNodeType } from './utils';

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    const logger = ctx.logger.prefix('getComponentControllerAs()');
    const cache = ngHelperServer.getCache(ctx.sourceFile.fileName);
    if (!cache) {
        logger.info(`cache not found for file(${ctx.sourceFile.fileName})!`);
        return;
    }

    const components = cache.getFileCacheMap().get(ctx.sourceFile.fileName)?.components;
    if (!components || !components.length) {
        logger.info(`file(${ctx.sourceFile.fileName}) has no components!`);
        return;
    }

    // 这里不考虑有多个组件（一般不会出现）的情况
    const componentName = components[0];
    const component = cache.getComponentMap().get(componentName);
    if (!component) {
        logger.info(`component(${componentName}) not found!`);
        return;
    }

    return component.controllerAs.value;
}

export function getComponentTypeCompletions(ctx: PluginContext, prefix: string): NgTypeCompletionResponse {
    const logger = ctx.logger.prefix('getComponentCompletions()');

    const minSyntaxNode = getExpressionSyntaxNode(ctx, prefix);
    const minPrefix = minSyntaxNode?.minNode.getText(minSyntaxNode?.sourceFile);
    logger.info('minPrefix:', minPrefix);
    if (!minSyntaxNode || !minPrefix) {
        return;
    }

    const cache = ngHelperServer.getCache(ctx.sourceFile.fileName);
    if (!cache) {
        logger.info(`cache not found! fileName: ${ctx.sourceFile.fileName}`);
        return;
    }

    const componentName = cache.getFileCacheMap().get(ctx.sourceFile.fileName)?.components[0];
    logger.info('componentName:', componentName);
    if (!componentName) {
        return;
    }

    const componentInfo = cache.getComponentMap().get(componentName)!;
    if (!minPrefix.startsWith(componentInfo.controllerAs.value)) {
        return;
    }

    const controllerType = getComponentControllerType(ctx, componentName);
    logger.info('controllerType:', typeToString(ctx, controllerType));

    if (!componentInfo.bindings.length && !controllerType) {
        logger.info('no bindings and controllerType not found!');
        return;
    }

    // ctrl. 的情况
    if (minPrefix === componentInfo.controllerAs.value + '.') {
        if (controllerType) {
            const completionItems = getPublicMembersTypeInfoOfType(ctx, controllerType);
            if (completionItems) {
                return completionItems;
            }
        }
        return getPublicMembersTypeInfoOfBindings(ctx, componentInfo.bindings);
    }

    if (controllerType) {
        const targetType = getNodeType(ctx, controllerType, minSyntaxNode);
        logger.info('targetType:', typeToString(ctx, targetType));
        if (!targetType) {
            return;
        }

        return getPublicMembersTypeInfoOfType(ctx, targetType);
    }
}

export function getControllerTypeCompletions(
    coreCtx: CorePluginContext,
    info: NgCtrlTypeCompletionRequest,
): NgTypeCompletionResponse {
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

    const minSyntaxNode = getExpressionSyntaxNode(ctx, info.prefix);
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

export function getComponentNameCompletions(
    coreCtx: CorePluginContext,
    filePath: string,
): NgComponentNameCompletionResponse {
    const logger = coreCtx.logger.prefix('getComponentNameCompletions()');

    const cache = ngHelperServer.getCache(filePath);
    if (!cache) {
        logger.info(`cache not found for file(${filePath})!`);
        return;
    }

    const componentMap = cache.getComponentMap();
    const directiveMap = cache.getDirectiveMap();

    const mapToComponentInfo = (x: ComponentInfo | DirectiveInfo) => ({
        componentName: x.name,
        transclude: Array.isArray(x.transclude)
            ? x.transclude.reduce(
                  (acc, curr) => {
                      acc[curr.name] = curr.value;
                      return acc;
                  },
                  {} as Record<string, string>,
              )
            : x.transclude,
    });

    const components = Array.from(componentMap.values()).map(mapToComponentInfo);
    const directiveAsElements = Array.from(directiveMap.values()).filter(isElementDirective).map(mapToComponentInfo);

    return components.concat(directiveAsElements);
}

export function getComponentAttrCompletions(
    coreCtx: CorePluginContext,
    filePath: string,
    componentName: string,
): NgComponentAttrCompletionResponse {
    const logger = coreCtx.logger.prefix('getComponentAttrCompletions()');

    const cache = ngHelperServer.getCache(filePath);
    if (!cache) {
        logger.info(`cache not found for file(${filePath})!`);
        return;
    }

    const componentMap = cache.getComponentMap();
    const directiveMap = cache.getDirectiveMap();

    if (componentMap.has(componentName)) {
        return getComponentAttrCompletionsViaComponentFileInfo(coreCtx, componentMap.get(componentName)!);
    } else if (directiveMap.has(componentName)) {
        const directive = directiveMap.get(componentName)!;
        if (isElementDirective(directive)) {
            return getTypeInfosFromDirectiveScope(coreCtx, directive);
        }
    }
}

function getComponentAttrCompletionsViaComponentFileInfo(
    coreCtx: CorePluginContext,
    componentInfo: ComponentInfo,
): NgTypeInfo[] | undefined {
    const logger = coreCtx.logger.prefix('getComponentAttrCompletionsViaComponentFileInfo()');

    const ctx = getCtxOfCoreCtx(coreCtx, componentInfo.filePath);
    if (!ctx) {
        return;
    }

    const controllerType = getComponentControllerType(ctx, componentInfo.name);
    logger.info('controllerType:', typeToString(ctx, controllerType));

    const typeFromBindings = getPublicMembersTypeInfoOfBindings(ctx, componentInfo.bindings, true);
    if (!typeFromBindings || !controllerType) {
        return typeFromBindings;
    }

    const typeFromProps = getPublicMembersTypeInfoOfType(ctx, controllerType);
    if (!typeFromProps) {
        return typeFromBindings;
    }

    return mergeTypeInfo(typeFromBindings, typeFromProps, getToPropsNameMap(componentInfo.bindings));

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

    function getToPropsNameMap(bindings: Property[]): Map<string, string> {
        const result = new Map<string, string>();
        for (const binding of bindings) {
            result.set(getBindingName(binding), binding.name);
        }
        return result;
    }
}

export function resolveCtrlCtx(
    coreCtx: CorePluginContext,
    fileName: string,
    controllerName: string,
): PluginContext | undefined {
    const logger = coreCtx.logger.prefix('resolveCtrlCtx()');

    const cache = ngHelperServer.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const controllerInfo = cache.getControllerMap().get(controllerName);
    if (!controllerInfo) {
        logger.info(`controllerInfo not found for file(${fileName})!`);
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, controllerInfo.filePath);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    return ctx;
}

/**
 * 获取指令(作为属性使用时)补全
 * @param coreCtx
 * @param info
 * @returns
 */
export function getDirectiveCompletions(
    coreCtx: CorePluginContext,
    info: NgDirectiveCompletionRequest,
): NgDirectiveCompletionResponse {
    const logger = coreCtx.logger.prefix('getDirectiveCompletions()');

    const cache = ngHelperServer.getCache(info.fileName);
    if (!cache) {
        logger.info(`cache not found for file(${info.fileName})!`);
        return;
    }

    const matchedDirectives = findMatchedDirectives(cache, info.attrNames);
    logger.info(
        'Matched directives:',
        matchedDirectives.map((d) => d.name),
    );

    if (info.queryType === 'directiveAttr' && matchedDirectives.length) {
        const closestDirective = findClosestMatchedDirective(
            matchedDirectives,
            info.attrNames,
            info.afterCursorAttrName,
        );
        logger.info('Closest directive:', closestDirective ? closestDirective.name : 'None');
        if (closestDirective) {
            const typeInfos = getTypeInfosFromDirectiveScope(coreCtx, closestDirective);
            return typeInfos?.filter((typeInfo) => !info.attrNames.includes(typeInfo.name)) || [];
        }
    } else if (info.queryType === 'directive') {
        let attributeDirectives = getDirectivesUsableAsAttributes(cache);
        if (matchedDirectives.length) {
            const matchedDirectiveNames = new Set(matchedDirectives.map((d) => d.name));
            attributeDirectives = attributeDirectives.filter((d) => !matchedDirectiveNames.has(d.name));
        }
        return attributeDirectives.map((directive) => ({
            kind: 'property',
            name: directive.name,
            typeString: '',
            document: '',
            isFunction: false,
            isFilter: false,
        }));
    }
}

function findClosestMatchedDirective(
    matchedDirectives: DirectiveInfo[],
    attrNames: string[],
    afterCursorAttrName: string,
): DirectiveInfo | undefined {
    const cursorIndex = afterCursorAttrName ? attrNames.indexOf(afterCursorAttrName) : attrNames.length;
    for (let i = cursorIndex - 1; i >= 0; i--) {
        const directive = matchedDirectives.find((d) => d.name === attrNames[i]);
        if (directive) {
            return directive;
        }
    }
    return undefined;
}

export function getFilterNameCompletions(coreCtx: CorePluginContext, info: NgRequest): NgTypeCompletionResponse {
    const logger = coreCtx.logger.prefix('getFilterNameCompletions()');

    const cache = ngHelperServer.getCache(info.fileName);
    if (!cache) {
        logger.info(`cache not found for file(${info.fileName})!`);
        return;
    }

    const filterMap = cache.getFilterMap();
    return Array.from(filterMap.values()).map((x) => ({
        kind: 'property',
        name: x.name,
        typeString: `(${formatParameters(x.parameters)}): any`,
        document: '',
        isFunction: false,
        isFilter: true,
        // 注意：这里用于自动补全，要跳过第一个参数。上面显示类型的部分不用跳过。
        paramNames: x.parameters.slice(1).map((p) => p.name),
    }));
}
