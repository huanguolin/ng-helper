import {
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgTypeInfo,
    NgDirectiveHoverRequest,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { ngHelperServer } from '../ngHelperServer';
import type { ComponentInfo, DirectiveInfo, Property } from '../ngHelperServer/ngCache';
import { getCtxOfCoreCtx } from '../ngHelperServer/utils';
import { CorePluginContext, NgComponentTypeInfo, PluginContext } from '../type';
import { findMatchedDirectives } from '../utils/biz';
import { getPropertyType, getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import {
    getComponentTypeInfo,
    getComponentDeclareLiteralNode,
    getPublicMembersTypeInfoOfBindings,
    getControllerType,
    removeBindingControlChars,
    getBindingType,
    INDENT,
} from '../utils/ng';

import { beautifyTypeString, buildHoverInfo, findComponentOrDirectiveInfo, getMinSyntaxNodeForHover } from './utils';

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

    const cache = ngHelperServer.getCache(fileName);
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

function getComponentNameHoverInfo(coreCtx: CorePluginContext, componentInfo: ComponentInfo) {
    const component = `(component) ${componentInfo.name}`;

    const bindingTypeMap = getComponentBindingTypeMap(coreCtx, componentInfo) ?? new Map<string, NgTypeInfo>();
    const bindings = formatLiteralObj('bindings', componentInfo.bindings, (x) => bindingTypeMap.get(x.name)?.typeString ?? '');
    const transclude = formatTransclude(componentInfo.transclude);

    return {
        formattedTypeString: [component, bindings, transclude].filter((x) => !!x).join('\n'),
        document: '',
    };
}

function getComponentAttrHoverInfo(coreCtx: CorePluginContext, attrName: string, componentInfo: ComponentInfo) {
    const binding = componentInfo.bindings.find((x) => removeBindingControlChars(x.value) === attrName || x.name === attrName);
    if (!binding) {
        return;
    }

    const result = {
        formattedTypeString: `(property) ${attrName}: ${getBindingType(binding.value)}`,
        document: '',
    };

    const bindingTypeMap = getComponentBindingTypeMap(coreCtx, componentInfo) ?? new Map<string, NgTypeInfo>();
    if (bindingTypeMap.has(binding.name)) {
        const typeInfo = bindingTypeMap.get(binding.name)!;
        result.formattedTypeString = `(property) ${attrName}: ${beautifyTypeString(typeInfo.typeString)}`;
        if (typeInfo.document) {
            result.document += `\n${typeInfo.document}`;
        }
    }

    return result;
}

function getComponentBindingTypeMap(coreCtx: CorePluginContext, componentInfo: ComponentInfo) {
    if (componentInfo.bindings.length === 0) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, componentInfo.filePath);
    if (!ctx) {
        return;
    }

    const componentLiteralNode = getComponentDeclareLiteralNode(ctx, componentInfo.name);
    if (!componentLiteralNode) {
        return;
    }

    const info = getComponentTypeInfo(ctx, componentLiteralNode);
    if (!info.controllerType) {
        return;
    }

    const types = getPublicMembersTypeInfoOfType(ctx, info.controllerType);
    if (!types) {
        return;
    }

    return new Map(types.map((x) => [x.name, x]));
}

function getDirectiveAttrHoverInfo(attrName: string, directiveInfo: DirectiveInfo, isAttrDirectiveStyle: boolean) {
    const attr = directiveInfo.scope.find((x) => removeBindingControlChars(x.value) === attrName || x.name === attrName);
    if (!attr) {
        return;
    }

    const prefix = isAttrDirectiveStyle ? `attribute of [${directiveInfo.name}]` : 'property';
    const attrInfo = `(${prefix}) ${attr.name}: ${getBindingType(attr.value)}`;
    const scopeInfo = `scope configs: "${attr.value}"`;

    return {
        formattedTypeString: [attrInfo, scopeInfo].filter((x) => !!x).join('\n'),
        document: '',
    };
}

function getDirectiveNameHoverInfo(directiveInfo: DirectiveInfo) {
    const directive = `(directive) ${directiveInfo.name}`;
    const others = getOtherProps(['restrict', 'require', 'priority', 'terminal']);
    const formattedTypeString = [directive, ...others, formatLiteralObj('scope', directiveInfo.scope), formatTransclude(directiveInfo.transclude)]
        .filter((x) => !!x)
        .join('\n');

    return {
        formattedTypeString,
        document: '',
    };

    function getOtherProps(propNames: (keyof DirectiveInfo)[]): string[] {
        return propNames.map((p) => {
            const v = directiveInfo[p] as string;
            return v ? `${p}: "${v}"` : '';
        });
    }
}

function formatLiteralObj(objName: string, objProps: Property[], getComment?: (prop: Property) => string) {
    if (objProps.length === 0) {
        return `${objName}: { }`;
    }
    return `${objName}: {\n${formatLiteralObjProps(objProps, getComment)}\n}`;
}

function formatLiteralObjProps(objProps: Property[], getComment?: (prop: Property) => string) {
    return objProps.map((p) => `${INDENT}${p.name}: "${p.value}"${getComment ? ` // ${getComment(p)}` : ''}`).join('\n');
}

function formatTransclude(transclude: DirectiveInfo['transclude']) {
    let transcludeString = '';
    if (Array.isArray(transclude)) {
        transcludeString = `transclude: {\n${formatLiteralObjProps(transclude)}\n}`;
    } else if (transclude) {
        transcludeString = `transclude: true`;
    }
    return transcludeString;
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

    // hover 在根节点上
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

    // hover 在根节点上
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

    const cache = ngHelperServer.getCache(fileName);
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
            const attr = directive.scope.find((s) => s.name === cursorAtAttrName);
            if (attr) {
                return getDirectiveAttrHoverInfo(cursorAtAttrName, directive, true);
            }
        }
    }
}
