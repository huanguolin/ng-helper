import {
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgDirectiveHoverRequest,
    type ComponentInfo,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getExpressionSyntaxNode } from '../completion/utils';
import { ngHelperTsService } from '../ngHelperTsService';
import { CorePluginContext, PluginContext, type SyntaxNodeInfo } from '../type';
import { findMatchedDirectives } from '../utils/biz';
import { formatParameters, getPropertyType, typeToString } from '../utils/common';
import {
    getControllerType,
    getBindingType,
    getComponentControllerType,
    getBindingTypeInfo,
    getBindingName,
} from '../utils/ng';

import {
    beautifyTypeString,
    buildHoverInfo,
    findComponentOrDirectiveInfo,
    getComponentAttrHoverInfo,
    getComponentNameHoverInfo,
    getDirectiveAttrHoverInfo,
    getDirectiveNameHoverInfo,
    getMinSyntaxNodeForHover,
} from './utils';

/**
 * 获取组件(包含指令用作元素时)或属性名称悬停信息
 * @param coreCtx 核心上下文
 * @param hoverInfo 元素悬停信息
 * @returns 组件或指令名称或属性名称悬停信息
 */
export function getComponentNameOrAttrNameHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getComponentNameOrAttrNameHoverInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found! fileName: ${fileName}`);
        return;
    }

    const { componentInfo, directiveInfo, transcludeConfig } = findComponentOrDirectiveInfo(cache, hoverInfo);

    if (!componentInfo && !directiveInfo) {
        logger.info(`componentInfo and directiveInfo not found!`);
        return;
    }

    if (transcludeConfig) {
        return getTranscludeHoverInfo();
    }

    if (componentInfo) {
        if (hoverInfo.type === 'tagName') {
            return getComponentNameHoverInfo(coreCtx, componentInfo);
        } else {
            return getComponentAttrHoverInfo(coreCtx, hoverInfo.name, componentInfo);
        }
    } else if (directiveInfo) {
        if (hoverInfo.type === 'tagName') {
            return getDirectiveNameHoverInfo(directiveInfo);
        } else {
            return getDirectiveAttrHoverInfo(hoverInfo.name, directiveInfo, false);
        }
    }

    function getTranscludeHoverInfo() {
        const arr = [
            `(transclude) ${hoverInfo.tagName}`,
            `config: "${transcludeConfig}"`,
            `${componentInfo ? 'component' : 'directive'}: "${hoverInfo.tagName}"`,
        ];
        return {
            formattedTypeString: arr.join('\n'),
            document: '',
        };
    }
}

export function getComponentTypeHoverInfo(
    ctx: PluginContext,
    { contextString, cursorAt, hoverPropName }: NgHoverRequest,
): NgHoverResponse {
    const logger = ctx.logger.prefix('getComponentHoverType()');

    const cache = ngHelperTsService.getCache(ctx.sourceFile.fileName);
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

    const controllerType = getComponentControllerType(ctx, componentName);
    logger.info('controllerType:', typeToString(ctx, controllerType));

    if (!componentInfo.bindings.length && !controllerType) {
        logger.info('no bindings and controllerType not found!');
        return;
    }

    const minSyntax = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
    if (!minSyntax) {
        logger.info('minSyntax not found!');
        return;
    }

    // ng-repeat 的数组项
    if (cursorAt < 0 && hoverPropName) {
        return getHoverInfoOfArrayItem({ ctx, minSyntax: minSyntax, hoverPropName, componentName });
    }

    const { sourceFile, minNode, targetNode } = minSyntax;
    const minPrefix = minNode.getText(sourceFile);
    logger.info('minPrefix:', minPrefix, 'targetNode:', targetNode.getText(sourceFile));
    if (!minPrefix.startsWith(componentInfo.controllerAs.value) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    if (controllerType) {
        const hoverInfo = getHoverInfoOfType({
            ctx,
            controllerType,
            controllerAs: componentInfo.controllerAs.value,
            contextString,
            targetNode,
            minSyntaxSourceFile: sourceFile,
        });
        if (hoverInfo) {
            return hoverInfo;
        }
    }

    if (componentInfo.bindings.length > 0) {
        return getHoverInfoOfBindings(componentInfo, targetNode.text);
    }
}

export function getControllerTypeHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, controllerName, controllerAs, contextString, cursorAt, hoverPropName }: NgCtrlHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getControllerHoverType()');

    const ctx = resolveCtrlCtx(coreCtx, fileName, controllerName);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    if (!controllerAs) {
        if (contextString === controllerName) {
            return getControllerNameHoverInfo(ctx, controllerName);
        }
        logger.info('controllerAs not found!');
        return;
    }

    const minSyntax = getMinSyntaxNodeForHover(ctx, contextString, cursorAt);
    if (!minSyntax) {
        logger.info('minSyntax not found!');
        return;
    }

    // ng-repeat 的数组项
    if (cursorAt < 0 && hoverPropName) {
        return getHoverInfoOfArrayItem({ ctx, minSyntax: minSyntax, hoverPropName });
    }

    const { sourceFile, minNode, targetNode } = minSyntax;
    const minPrefix = minNode.getText(sourceFile);
    logger.info('minPrefix:', minPrefix, 'targetNode:', targetNode.getText(sourceFile));
    // 这里判断 minPrefix !== controllerName，是处理当 hover 在 ng-controller="X as ctrl" 的 X 上时。
    if ((!minPrefix.startsWith(controllerAs) && minPrefix !== controllerName) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    // 处理当 hover 在 ng-controller="X as ctrl" 的 X 上时。
    if (minPrefix === controllerName) {
        controllerAs = controllerName;
    }

    const controllerType = getControllerType(ctx);
    if (!controllerType) {
        // hover 在根节点上
        if (targetNode.text === controllerAs) {
            return getControllerNameHoverInfo(ctx, controllerName);
        }
        logger.info('controllerType not found!');
        return;
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

function getControllerNameHoverInfo(ctx: PluginContext, controllerName: string): NgHoverResponse {
    const logger = ctx.logger.prefix('getControllerNameHoverInfo()');

    const cache = ngHelperTsService.getCache(ctx.sourceFile.fileName);
    if (!cache) {
        logger.info(`cache not found for file(${ctx.sourceFile.fileName})!`);
        return;
    }

    const controllerInfo = cache.getControllerMap().get(controllerName);
    if (!controllerInfo) {
        logger.info(`controllerInfo not found for controllerName(${controllerName})!`);
        return;
    }

    return {
        formattedTypeString: `(controller) ${controllerName}: any`,
        document: '',
    };
}

function getHoverInfoOfArrayItem({
    ctx,
    componentName,
    minSyntax,
    hoverPropName,
}: {
    ctx: PluginContext;
    minSyntax: SyntaxNodeInfo;
    hoverPropName: string;
    componentName?: string;
}): NgHoverResponse {
    const controllerType = componentName ? getComponentControllerType(ctx, componentName) : getControllerType(ctx);
    if (!controllerType) {
        return;
    }

    const type = getNodeType(ctx, controllerType, minSyntax);
    if (!type) {
        return;
    }

    return buildHoverInfo({ ctx, targetType: type, name: hoverPropName });
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

    // hover 在根节点上
    if (targetNode.text === controllerAs) {
        logger.info('targetType:', typeToString(ctx, controllerType));
        return buildHoverInfo({ ctx, targetType: controllerType, name: targetNode.text });
    }

    // hover 在后代节点上, 取父节点的类型(目的是需要通过它获取关联的文档)，然后再取目标节点类型
    const prefixContextString = contextString.slice(0, targetNode.getStart(minSyntaxSourceFile));
    const prefixMinSyntaxNode = getExpressionSyntaxNode(ctx, prefixContextString)!;
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

function getHoverInfoOfBindings(componentInfo: ComponentInfo, hoverPropName: string): NgHoverResponse {
    // hover 在根节点上
    if (hoverPropName === componentInfo.controllerAs.value) {
        const typeString =
            '{' +
            componentInfo.bindings.reduce((acc, cur) => {
                const s = `${cur.name}: ${getBindingType(cur.value, false)};`;
                return acc ? `${acc} ${s}` : s;
            }, '') +
            '}';
        return {
            formattedTypeString: `(object) ${hoverPropName}: ${beautifyTypeString(typeString)}`,
            document: '',
        };
    }

    const binding = componentInfo.bindings.find((t) => t.name === hoverPropName);
    if (binding) {
        const typeInfo = getBindingTypeInfo(binding, false);
        return {
            formattedTypeString: `(property) ${hoverPropName}: ${typeInfo.typeString}`,
            document: typeInfo.document,
        };
    } else {
        return {
            formattedTypeString: `(property) ${hoverPropName}: any`,
            document: '',
        };
    }
}

/**
 * 获取指令(仅作为属性使用时)悬停信息
 * @param coreCtx 核心上下文
 * @param hoverInfo 指令悬停信息
 * @returns 指令悬停信息
 */
export function getDirectiveHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, attrNames, cursorAtAttrName }: NgDirectiveHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getDirectiveHoverInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found! fileName: ${fileName}`);
        return;
    }

    const matchedDirectives = findMatchedDirectives(cache, attrNames);
    logger.info(
        'Matched directives:',
        matchedDirectives.map((d) => d.name),
    );
    if (!matchedDirectives.length) {
        return;
    }

    const hoverDirective = matchedDirectives.find((x) => x.name === cursorAtAttrName);
    if (hoverDirective) {
        // 说明光标所在的属性名即指令名
        return getDirectiveNameHoverInfo(hoverDirective);
    } else {
        // 说明光标所在的属性名是指令的属性名
        // 需要遍历所有匹配的指令，找到对应的属性值
        for (const directive of matchedDirectives) {
            const attr = directive.scope.find((s) => getBindingName(s) === cursorAtAttrName);
            if (attr) {
                return getDirectiveAttrHoverInfo(cursorAtAttrName, directive, true);
            }
        }
    }
}

export function getFilterNameHoverInfo(
    coreCtx: CorePluginContext,
    { contextString: filterName, fileName }: NgHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getFilterNameHoverInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found! fileName: ${fileName}`);
        return;
    }

    const filterMap = cache.getFilterMap();
    const filter = filterMap.get(filterName);
    if (!filter) {
        return;
    }

    return {
        formattedTypeString: `(filter) ${filter.name}(${formatParameters(filter.parameters)}): any`,
        document: '',
    };
}
