import {
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgControllerNameDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgDefinitionResponse,
    type NgDirectiveDefinitionRequest,
    type NgFilterNameDefinitionRequest,
    type NgTypeDefinitionRequest,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';
import type { DefinitionInfoAndBoundSpan } from 'typescript';
import type tsserver from 'typescript/lib/tsserverlibrary';

import { resolveCtrlCtx } from '../completion';
import { isAngularFile } from '../diagnostic/utils';
import { findComponentOrDirectiveInfo, getMinSyntaxNodeForHover } from '../hover/utils';
import { ngHelperServer } from '../ngHelperServer';
import type { ComponentInfo, DirectiveInfo } from '../ngHelperServer/ngCache';
import { CorePluginContext, type PluginContext } from '../type';
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

    const cache = ngHelperServer.getCache(fileName);
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

    const cache = ngHelperServer.getCache(fileName);
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
        return getDefinitionInfo((componentInfo || directiveInfo)!);
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

    // 目前仅支持 ctrl.x 的情况, 不支持 ctrl.x.y 的情况
    const propDeep = minPrefix.split('.').length;
    logger.info('propDeep:', propDeep);
    if (propDeep > 2) {
        return;
    }

    if (controllerType) {
        const hoverInfo = getTypeDefinitionInfo({
            ctx,
            controllerType,
            controllerAs: componentInfo.controllerAs.value,
            targetNode,
            propDeep,
        });
        if (hoverInfo) {
            return hoverInfo;
        }
    }

    // hover 在根节点上
    if (propDeep === 1 && targetNode.text === componentInfo.controllerAs.value) {
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

function getTypeDefinitionInfo({
    ctx,
    controllerType,
    controllerAs,
    targetNode,
    propDeep,
}: {
    ctx: PluginContext;
    controllerType: ts.Type;
    controllerAs: string;
    targetNode: ts.Identifier;
    propDeep: number;
}) {
    const classDeclaration = controllerType.symbol.declarations![0] as ts.ClassDeclaration;

    // hover 在根节点上
    if (propDeep === 1 && targetNode.text === controllerAs) {
        ctx.logger.info('targetType:', typeToString(ctx, controllerType));
        return {
            filePath: ctx.sourceFile.fileName,
            start: classDeclaration.name!.getStart(ctx.sourceFile),
            end: classDeclaration.name!.getEnd(),
        };
    }

    if (propDeep === 2) {
        const prop = classDeclaration.members.find(
            (m) =>
                (ctx.ts.isPropertyDeclaration(m) || ctx.ts.isMethodDeclaration(m)) &&
                m.name.getText() === targetNode.text,
        );
        if (prop) {
            return {
                filePath: ctx.sourceFile.fileName,
                start: prop.getStart(ctx.sourceFile),
                end: prop.getEnd(),
            };
        }
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

    // 目前仅支持 ctrl.x 的情况, 不支持 ctrl.x.y 的情况
    const propDeep = minPrefix.split('.').length;
    logger.info('propDeep:', propDeep);
    if (propDeep > 2) {
        return;
    }

    const controllerType = getControllerType(ctx);
    if (!controllerType) {
        // hover 在根节点上
        if (propDeep === 1 && targetNode.text === controllerAs) {
            return getControllerNameDefinitionInfo(ctx, { fileName, controllerName });
        }
        logger.info('controllerType not found!');
        return;
    }

    return getTypeDefinitionInfo({
        ctx,
        controllerType,
        controllerAs,
        targetNode,
        propDeep,
    });
}

export function getControllerNameDefinitionInfo(
    ctx: PluginContext,
    { fileName, controllerName }: NgControllerNameDefinitionRequest,
): NgDefinitionResponse {
    const logger = ctx.logger.prefix('getControllerNameDefinitionInfo()');

    const cache = ngHelperServer.getCache(fileName);
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

    const cache = ngHelperServer.getCache(fileName);
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
        if (prior || isDtsFile(fileName) || !ngHelperServer.isExtensionActivated()) {
            return prior;
        }

        const ctx = ngHelperServer.getContext(fileName);
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
        const cache = ngHelperServer.getCache(ctx.sourceFile.fileName);
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
