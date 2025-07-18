import {
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgControllerNameDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgDefinitionResponse,
    type NgDirectiveDefinitionRequest,
    type NgFilterNameDefinitionRequest,
    type NgTypeDefinitionRequest,
    type ComponentInfo,
    type DirectiveInfo,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';
import type { DefinitionInfoAndBoundSpan } from 'typescript';
import type tsserver from 'typescript/lib/tsserverlibrary';

import { resolveCtrlCtx } from '../completion';
import { getExpressionSyntaxNode, getNodeType } from '../completion/utils';
import { isAngularFile } from '../diagnostic/utils';
import { findComponentOrDirectiveInfo, getMinSyntaxNodeForHover } from '../hover/utils';
import { ngHelperTsService } from '../ngHelperTsService';
import { CorePluginContext, type PluginContext, type SyntaxNodeInfoEx } from '../type';
import { findMatchedDirectives } from '../utils/biz';
import { getNodeAtPosition, typeToString } from '../utils/common';
import { getBindingName, getComponentControllerType, getControllerType, isDtsFile } from '../utils/ng';

/**
 * 获取指令(作为属性使用时)定义信息
 * @param coreCtx 核心插件上下文
 * @param request 请求
 * @returns 指令定义信息
 */
export function getDirectiveDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, attrNames, cursorAtAttrName }: NgDirectiveDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getDirectiveDefinitionInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
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

    const hoverDirective = matchedDirectives.find((d) => d.name === cursorAtAttrName);
    if (hoverDirective) {
        // 说明光标所在的属性名即指令名
        return {
            filePath: hoverDirective.filePath,
            ...hoverDirective.location,
        };
    } else {
        // 说明光标所在的属性名是指令的属性名
        // 需要遍历所有匹配的指令，找到对应的属性值
        for (const directive of matchedDirectives) {
            const attr = directive.scope.find((s) => getBindingName(s) === cursorAtAttrName);
            if (attr) {
                return {
                    filePath: directive.filePath,
                    ...attr.location,
                };
            }
        }
    }
}

/**
 * 获取组件(包括指令作为元素使用)或组件的属性定义信息
 * @param coreCtx 核心插件上下文
 * @param request 请求
 * @returns 组件或组件的属性定义信息
 */
export function getComponentNameOrAttrNameDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getComponentNameOrAttrNameDefinitionInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const { componentInfo, directiveInfo, transcludeConfig } = findComponentOrDirectiveInfo(cache, hoverInfo);
    logger.info(
        'componentInfo:',
        componentInfo,
        'directiveInfo:',
        directiveInfo,
        'transcludeConfig:',
        transcludeConfig,
    );

    if (componentInfo || directiveInfo) {
        return getDefinitionInfo(componentInfo ? componentInfo : directiveInfo!);
    }

    function getDefinitionInfo(info: ComponentInfo | DirectiveInfo): NgDefinitionResponse {
        if (hoverInfo.type === 'tagName' && !transcludeConfig) {
            return {
                filePath: info.filePath,
                ...info.location,
            };
        }

        if (hoverInfo.type === 'attrName') {
            const attrList = 'scope' in info ? info.scope : info.bindings;
            const attr = attrList.find((s) => getBindingName(s) === hoverInfo.name);
            if (attr) {
                return {
                    filePath: info.filePath,
                    ...attr.location,
                };
            }
        } else if (transcludeConfig && Array.isArray(info.transclude)) {
            const transclude = info.transclude.find((t) => t.value === transcludeConfig);
            if (transclude) {
                return {
                    filePath: info.filePath,
                    ...transclude.location,
                };
            }
        }
    }
}

/**
 * 获取组件类型定义信息
 * @param ctx 插件上下文
 * @param request 请求
 * @returns 组件类型定义信息
 */
export function getComponentTypeDefinitionInfo(
    ctx: PluginContext,
    { contextString, cursorAt }: NgTypeDefinitionRequest,
): NgDefinitionResponse {
    const logger = ctx.logger.prefix('getComponentTypeDefinitionInfo()');

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

    const { sourceFile, minNode, targetNode } = minSyntax;
    const minPrefix = minNode.getText(sourceFile);
    logger.info('minPrefix:', minPrefix, 'targetNode:', targetNode.getText(sourceFile));
    if (!minPrefix.startsWith(componentInfo.controllerAs.value) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    if (controllerType) {
        const hoverInfo = getDefinitionInfoViaType({
            ctx,
            controllerType,
            minSyntaxNode: minSyntax,
            controllerAs: componentInfo.controllerAs.value,
        });
        if (hoverInfo) {
            return hoverInfo;
        }
    }

    const propertyPath = minPrefix.split('.');
    logger.info('propertyPath length:', propertyPath.length);

    // hover 在根节点上
    if (propertyPath.length === 1 && targetNode.text === componentInfo.controllerAs.value) {
        if (componentInfo.controllerAs.location) {
            return {
                filePath: ctx.sourceFile.fileName,
                ...componentInfo.controllerAs.location,
            };
        } else {
            return {
                filePath: ctx.sourceFile.fileName,
                ...componentInfo.location,
            };
        }
    }

    const binding = componentInfo.bindings.find((t) => t.name === targetNode.text);
    if (binding) {
        return {
            filePath: ctx.sourceFile.fileName,
            ...binding.location,
        };
    }
}

function getDefinitionInfoViaType({
    ctx,
    controllerType,
    controllerAs,
    minSyntaxNode,
}: {
    ctx: PluginContext;
    controllerType: ts.Type;
    controllerAs: string;
    minSyntaxNode: SyntaxNodeInfoEx;
}): NgDefinitionResponse | undefined {
    const { sourceFile, minNode, targetNode } = minSyntaxNode;
    const propertyPath = minNode.getText(sourceFile).split('.');

    // Case 1: Hover on controller alias (root level)
    if (propertyPath.length === 1 && targetNode.getText() === controllerAs) {
        const classDeclaration = controllerType.symbol.declarations![0] as ts.ClassDeclaration;
        return {
            filePath: ctx.sourceFile.fileName,
            start: classDeclaration.name!.getStart(ctx.sourceFile),
            end: classDeclaration.name!.getEnd(),
        };
    }

    // Case 2: Hover on property chain
    const prefixContextString = sourceFile.getText().slice(0, targetNode.getStart(sourceFile));
    const prefixMinSyntaxNode = getExpressionSyntaxNode(ctx, prefixContextString)!;
    const parentType = getNodeType(ctx, controllerType, prefixMinSyntaxNode);

    if (!parentType) {
        return;
    }

    const property = parentType.getProperty(minSyntaxNode.targetNode.getText());

    if (property && property.declarations) {
        const declaration = property.declarations[0];
        return {
            filePath: declaration.getSourceFile().fileName,
            start: declaration.getStart(ctx.sourceFile),
            end: declaration.getEnd(),
        };
    }
}

/**
 * 获取控制器类型定义信息
 * @param coreCtx 核心插件上下文
 * @param request 请求
 * @returns 控制器类型定义信息
 */
export function getControllerTypeDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, controllerName, controllerAs, contextString, cursorAt }: NgCtrlTypeDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getControllerTypeDefinitionInfo()');

    const ctx = resolveCtrlCtx(coreCtx, fileName, controllerName);
    if (!ctx) {
        logger.info('ctx not found!');
        return;
    }

    if (!controllerAs) {
        if (contextString === controllerName) {
            return getControllerNameDefinitionInfo(ctx, { fileName, controllerName });
        }
        logger.info('controllerAs not found!');
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
    // 这里判断 minPrefix !== controllerName，是处理当 hover 在 ng-controller="X as ctrl" 的 X 上时。
    if ((!minPrefix.startsWith(controllerAs) && minPrefix !== controllerName) || !ctx.ts.isIdentifier(targetNode)) {
        return;
    }

    // 处理当 hover 在 ng-controller="X as ctrl" 的 X 上时。
    if (minPrefix === controllerName) {
        controllerAs = controllerName;
    }

    const controllerType = getControllerType(ctx);
    if (controllerType) {
        return getDefinitionInfoViaType({
            ctx,
            controllerType,
            minSyntaxNode: minSyntax,
            controllerAs,
        });
    }
    logger.info('controllerType not found!');

    const propertyPath = minPrefix.split('.');
    logger.info('propertyPath length:', propertyPath.length);

    // hover 在根节点上
    if (propertyPath.length === 1 && targetNode.text === controllerAs) {
        return getControllerNameDefinitionInfo(ctx, { fileName, controllerName });
    }
}

export function getControllerNameDefinitionInfo(
    ctx: PluginContext,
    { fileName, controllerName }: NgControllerNameDefinitionRequest,
): NgDefinitionResponse {
    const logger = ctx.logger.prefix('getControllerNameDefinitionInfo()');

    const cache = ngHelperTsService.getCache(fileName);
    if (!cache) {
        logger.info(`cache not found for file(${fileName})!`);
        return;
    }

    const controllerInfo = cache.getControllerMap().get(controllerName);
    if (!controllerInfo) {
        logger.info(`controllerInfo not found for controllerName(${controllerName})!`);
        return;
    }

    return {
        filePath: controllerInfo.filePath,
        ...controllerInfo.location,
    };
}

export function getFilterNameDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, filterName }: NgFilterNameDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getFilterNameDefinitionInfo()');

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
        filePath: filter.filePath,
        ...filter.location,
    };
}

export function overrideGetDefinitionAtPosition({
    proxy,
    info,
}: {
    proxy: tsserver.LanguageService;
    info: tsserver.server.PluginCreateInfo;
}) {
    proxy.getDefinitionAndBoundSpan = (fileName: string, position: number) => {
        const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position);
        if (prior || isDtsFile(fileName) || !ngHelperTsService.isNgHelperCanHandled(info, fileName)) {
            return prior;
        }

        const ctx = ngHelperTsService.getContext(fileName);
        if (!ctx || !isAngularFile(ctx)) {
            return;
        }

        try {
            return serviceDefinition(ctx, position);
        } catch (error) {
            ctx.logger.error('serviceDefinition():', (error as Error).message, (error as Error).stack);
        }
    };
}

function serviceDefinition(ctx: PluginContext, position: number): DefinitionInfoAndBoundSpan | undefined {
    const logger = ctx.logger.prefix('serviceDefinition()');
    const node = getNodeAtPosition(ctx, position);
    if (node && isDependencyInjectionString(node)) {
        const serviceName = node.text;
        const cache = ngHelperTsService.getCache(ctx.sourceFile.fileName);
        if (!cache) {
            logger.info(`cache not found! fileName: ${ctx.sourceFile.fileName}`);
            return;
        }

        const serviceMap = cache.getServiceMap();
        const service = serviceMap.get(serviceName);
        logger.info('service:', service);
        if (!service) {
            return;
        }

        const start = node.getStart(ctx.sourceFile);
        return {
            definitions: [
                {
                    textSpan: {
                        start: service.location.start,
                        length: service.location.end - service.location.start,
                    },
                    fileName: service.filePath,
                    // 下面几个不知道怎么填，就暂时使用下面的值
                    kind: ctx.ts.ScriptElementKind.string,
                    name: serviceName,
                    containerKind: ctx.ts.ScriptElementKind.string,
                    containerName: '',
                },
            ],
            textSpan: {
                start,
                length: node.getEnd() - start,
            },
        };
    }

    function isDependencyInjectionString(node: ts.Node): node is ts.StringLiteral {
        // 现在这个判断虽然简陋，但是支持 js/ts, 而且足够简单。
        // 至于在一些不是字符串注入的地方也会有效果，暂不考虑处理。因为用户一般不会这样用。
        return (
            ctx.ts.isStringLiteral(node) &&
            node.parent &&
            ctx.ts.isArrayLiteralExpression(node.parent) && // 匹配数组注入语法
            node.parent.elements.includes(node)
        );
    }
}
