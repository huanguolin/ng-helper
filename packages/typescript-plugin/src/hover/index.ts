import { SPACE } from '@ng-helper/shared/lib/html';
import {
    NgComponentNameOrAttrNameHoverRequest,
    NgCtrlHoverRequest,
    NgHoverRequest,
    NgHoverResponse,
    NgTypeInfo,
    type NgComponentNameInfo,
    type NgDirectiveNameInfo,
    NgDirectiveHoverRequest,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { resolveCtrlCtx } from '../completion';
import { getNodeType, getMinSyntaxNodeForCompletion } from '../completion/utils';
import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, NgComponentTypeInfo, PluginContext } from '../type';
import { findMatchedDirectives, type DirectiveFileInfo } from '../utils/biz';
import { getPropertyType, getPublicMembersTypeInfoOfType, typeToString } from '../utils/common';
import {
    getComponentTypeInfo,
    getComponentDeclareLiteralNode,
    getPublicMembersTypeInfoOfBindings,
    getControllerType,
    removeBindingControlChars,
    getDirectiveConfigNode,
    getPropValueByName,
    getObjLiteral,
    getTypeInfoOfDirectiveScope,
} from '../utils/ng';

import { beautifyTypeString, buildHoverInfo, findComponentOrDirectiveInfo, getMinSyntaxNodeForHover } from './utils';

export function getComponentNameOrAttrNameHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameHoverRequest,
): NgHoverResponse {
    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(fileName);
    if (!componentDirectiveMap) {
        return;
    }

    const { filePath, componentNameInfo, directiveNameInfo, transcludeConfig } = findComponentOrDirectiveInfo(componentDirectiveMap, hoverInfo);

    if (!filePath || (!componentNameInfo && !directiveNameInfo)) {
        return;
    }

    if (transcludeConfig) {
        return getTranscludeHoverInfo();
    }

    const ctx = getCtxOfCoreCtx(coreCtx, filePath);
    if (!ctx) {
        return;
    }

    if (componentNameInfo) {
        return getComponentHoverInfo(ctx, componentNameInfo);
    } else if (directiveNameInfo) {
        return getDirectiveHoverInfo(ctx, directiveNameInfo);
    }

    function getDirectiveHoverInfo(ctx: PluginContext, directiveNameInfo: NgDirectiveNameInfo): NgHoverResponse {
        const directiveConfigNode = getDirectiveConfigNode(ctx, directiveNameInfo.directiveName);
        if (!directiveConfigNode) {
            return;
        }

        const { attrsFromScope, scopeMap } = getDirectiveScopeInfo(ctx, directiveConfigNode);

        if (hoverInfo.type === 'tagName') {
            return getDirectiveNameHoverInfo({ ctx, tagName: hoverInfo.tagName, directiveNameInfo, directiveConfigNode, scopeMap, attrsFromScope });
        } else {
            return getDirectiveAttrHoverInfo({ attrName: hoverInfo.name, scopeMap, attrsFromScope });
        }
    }

    function getComponentHoverInfo(ctx: PluginContext, componentNameInfo: NgComponentNameInfo): NgHoverResponse {
        const componentLiteralNode = getComponentDeclareLiteralNode(ctx, componentNameInfo.componentName);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentTypeInfo(ctx, componentLiteralNode);
        const attrsFromBindings = getPublicMembersTypeInfoOfBindings(ctx, info.bindings, false) ?? [];

        let attrsFromType: NgTypeInfo[] = [];
        if (info.controllerType) {
            attrsFromType = getPublicMembersTypeInfoOfType(ctx, info.controllerType) ?? [];
        }

        const attrTypeMap = new Map<string, NgTypeInfo>(attrsFromType.map((x) => [x.name, x]));
        if (hoverInfo.type === 'tagName') {
            return getComponentNameHoverInfo();
        } else {
            return getComponentAttrHoverInfo();
        }

        function getComponentNameHoverInfo() {
            const component = `(component) ${hoverInfo.tagName}`;

            const indent = SPACE.repeat(4);
            let bindings = '';
            if (attrsFromBindings.length === 0) {
                bindings = `bindings: { }`;
            } else {
                bindings = attrsFromBindings
                    .map(
                        (x) =>
                            `${indent}${x.name}: "${info.bindings.get(x.name)}"; ${attrTypeMap.has(x.name) ? '// ' + attrTypeMap.get(x.name)!.typeString : ''}`,
                    )
                    .join('\n');
                bindings = `bindings: {\n${bindings}\n}`;
            }

            let transclude = '';
            if (componentNameInfo?.transclude) {
                if (typeof componentNameInfo.transclude === 'boolean') {
                    transclude = `transclude: true`;
                } else {
                    transclude = Object.entries(componentNameInfo.transclude)
                        .map(([k, v]) => `${indent}${k}: "${v}"`)
                        .join('\n');
                    transclude = `transclude: {\n${transclude}\n}`;
                }
            }

            return {
                formattedTypeString: [component, bindings, transclude].filter((x) => !!x).join('\n'),
                document: '',
            };
        }

        function getComponentAttrHoverInfo() {
            const attrBindingsMap = new Map<string, NgTypeInfo>(attrsFromBindings.map((x) => [x.name, x]));
            const result = {
                formattedTypeString: `(property) ${hoverInfo.name}: any`,
                document: '',
            };

            // 从 bindings 中获取在 class 上对应属性的名字
            const toPropsNameMap = getToPropsNameMap(info.bindings);
            const propName = toPropsNameMap.get(hoverInfo.name)!;

            if (attrBindingsMap.has(propName)) {
                result.document += '\n' + attrBindingsMap.get(propName)!.document;
            }

            if (attrTypeMap.has(propName)) {
                const typeInfo = attrTypeMap.get(propName)!;
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

    function getTranscludeHoverInfo() {
        const arr = [
            `(transclude) ${hoverInfo.tagName}`,
            `config: "${transcludeConfig}"`,
            `${componentNameInfo ? 'component' : 'directive'}: "${hoverInfo.parentTagName}"`,
        ];
        return {
            formattedTypeString: arr.join('\n'),
            document: '',
        };
    }
}

function getToPropsNameMap(bindingsMap: Map<string, string>): Map<string, string> {
    const result = new Map<string, string>();
    for (const [k, v] of bindingsMap) {
        const inputName = removeBindingControlChars(v).trim();
        result.set(inputName || k, k);
    }
    return result;
}

function getDirectiveAttrHoverInfo({
    attrName,
    scopeMap,
    attrsFromScope,
    isDirectiveStyle,
    directiveName,
}: {
    attrName: string;
    scopeMap: Map<string, string>;
    attrsFromScope: NgTypeInfo[];
    isDirectiveStyle?: boolean;
    directiveName?: string;
}) {
    // 从 bindings 中获取在 class 上对应属性的名字
    const toPropsNameMap = getToPropsNameMap(scopeMap);
    const propName = toPropsNameMap.get(attrName)!;

    const attr = attrsFromScope.find((x) => x.name === propName);
    if (!attr) {
        return;
    }

    const prefix = isDirectiveStyle ? `attribute of [${directiveName}]` : 'property';
    const attrInfo = `(${prefix}) ${attr.name}: ${attr.typeString}`;
    const scopeInfo = `scope configs: "${scopeMap.get(attr.name)}"`;

    return {
        formattedTypeString: [attrInfo, scopeInfo].filter((x) => !!x).join('\n'),
        document: '',
    };
}

function getDirectiveNameHoverInfo({
    ctx,
    tagName,
    directiveNameInfo,
    directiveConfigNode,
    scopeMap,
    attrsFromScope,
}: {
    ctx: PluginContext;
    tagName: string;
    directiveNameInfo: NgDirectiveNameInfo;
    directiveConfigNode: ts.ObjectLiteralExpression;
    scopeMap: Map<string, string>;
    attrsFromScope: NgTypeInfo[];
}) {
    const indent = SPACE.repeat(4);
    const directive = `(directive) ${tagName}`;
    const others = getOtherProps(['restrict', 'require', 'priority', 'terminal']);

    return {
        formattedTypeString: [directive, ...others, getScope(), getTransclude()].filter((x) => !!x).join('\n'),
        document: '',
    };

    function getOtherProps(propNames: string[]): string[] {
        return propNames.map((p) => {
            const v = getPropValueByName(ctx, directiveConfigNode, p);
            return v ? `${p}: ${v.getText(ctx.sourceFile)}` : '';
        });
    }

    function getTransclude() {
        let transclude = '';
        if (directiveNameInfo?.transclude) {
            if (typeof directiveNameInfo.transclude === 'boolean') {
                transclude = `transclude: true`;
            } else {
                transclude = Object.entries(directiveNameInfo.transclude)
                    .map(([k, v]) => `${indent}${k}: "${v}"`)
                    .join('\n');
                transclude = `transclude: {\n${transclude}\n}`;
            }
        }
        return transclude;
    }

    function getScope() {
        let scope = '';
        if (attrsFromScope.length === 0) {
            scope = `scope: { }`;
        } else {
            scope = attrsFromScope.map((x) => `${indent}${x.name}: "${scopeMap.get(x.name)}"; // ${x.typeString}`).join('\n');
            scope = `scope: {\n${scope}\n}`;
        }
        return scope;
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

export function getDirectiveHoverInfo(
    coreCtx: CorePluginContext,
    { fileName, attrNames, cursorAtAttrName }: NgDirectiveHoverRequest,
): NgHoverResponse {
    const logger = coreCtx.logger.prefix('getDirectiveHoverInfo()');
    const componentDirectiveMap = ngHelperServer.getComponentDirectiveMap(fileName);
    if (!componentDirectiveMap) {
        return;
    }

    const matchedDirectives = findMatchedDirectives(componentDirectiveMap, attrNames);
    logger.info(
        'Matched directives:',
        matchedDirectives.map((d) => d.directiveInfo.directiveName),
    );
    if (!matchedDirectives.length) {
        return;
    }

    const hoverDirective = matchedDirectives.find((x) => x.directiveInfo.directiveName === cursorAtAttrName);
    if (hoverDirective) {
        const directiveContext = getDirectiveContext(coreCtx, hoverDirective);
        if (!directiveContext) {
            return;
        }

        const { ctx, directiveConfigNode } = directiveContext;
        const { attrsFromScope, scopeMap } = getDirectiveScopeInfo(ctx, directiveConfigNode);

        return getDirectiveNameHoverInfo({
            ctx,
            tagName: cursorAtAttrName,
            directiveNameInfo: hoverDirective.directiveInfo,
            directiveConfigNode,
            scopeMap,
            attrsFromScope,
        });
    } else {
        for (const directive of matchedDirectives) {
            const directiveContext = getDirectiveContext(coreCtx, directive);
            if (!directiveContext) {
                continue;
            }

            const { ctx, directiveConfigNode } = directiveContext;
            const { attrsFromScope, scopeMap } = getDirectiveScopeInfo(ctx, directiveConfigNode);
            const attrHoverInfo = getDirectiveAttrHoverInfo({
                attrName: cursorAtAttrName,
                scopeMap,
                attrsFromScope,
                isDirectiveStyle: true,
                directiveName: directive.directiveInfo.directiveName,
            });
            // 如果找到了，则立即返回
            if (attrHoverInfo) {
                return attrHoverInfo;
            }
        }
    }
}

function getDirectiveContext(coreCtx: CorePluginContext, directive: DirectiveFileInfo) {
    const ctx = getCtxOfCoreCtx(coreCtx, directive.filePath);
    if (!ctx) {
        return null;
    }

    const directiveConfigNode = getDirectiveConfigNode(ctx, directive.directiveInfo.directiveName);
    if (!directiveConfigNode) {
        return null;
    }

    return { ctx, directiveConfigNode };
}

function getDirectiveScopeInfo(ctx: PluginContext, directiveConfigNode: ts.ObjectLiteralExpression) {
    const scopePropValue = getPropValueByName(ctx, directiveConfigNode, 'scope');
    let attrsFromScope: NgTypeInfo[] = [];
    let scopeMap = new Map<string, string>();
    if (scopePropValue && ctx.ts.isObjectLiteralExpression(scopePropValue)) {
        scopeMap = new Map<string, string>(Object.entries(getObjLiteral(ctx, scopePropValue)));
        attrsFromScope = getTypeInfoOfDirectiveScope(ctx, scopeMap, false) ?? [];
    }
    return { attrsFromScope, scopeMap };
}
