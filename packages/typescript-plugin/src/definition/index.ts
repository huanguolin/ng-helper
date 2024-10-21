import {
    type NgComponentNameOrAttrNameDefinitionRequest,
    type NgCtrlTypeDefinitionRequest,
    type NgDefinitionResponse,
    type NgDirectiveDefinitionRequest,
    type NgDirectiveNameInfo,
    type NgTypeDefinitionRequest,
} from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { resolveCtrlCtx } from '../completion';
import { findComponentOrDirectiveInfo, getDirectiveContext, getMinSyntaxNodeForHover } from '../hover/utils';
import { ngHelperServer } from '../ngHelperServer';
import { getCtxOfCoreCtx } from '../ngHelperServer/utils';
import { CorePluginContext, type PluginContext } from '../type';
import { findMatchedDirectives } from '../utils/biz';
import { typeToString } from '../utils/common';
import { getProp, getPropByName, getPropValueByName } from '../utils/common';
import {
    getComponentDeclareLiteralNode,
    getComponentTypeInfo,
    getControllerType,
    getDirectiveConfigNode,
    isAngularComponentRegisterNode,
    isAngularDirectiveRegisterNode,
} from '../utils/ng';

export function getDirectiveDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, attrNames, cursorAtAttrName }: NgDirectiveDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getDirectiveDefinitionInfo()');

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

    const hoverDirective = matchedDirectives.find((d) => d.directiveInfo.directiveName === cursorAtAttrName);
    if (hoverDirective) {
        const ctx = getCtxOfCoreCtx(coreCtx, hoverDirective.filePath);
        if (!ctx) {
            return;
        }

        const directiveConfigNode = getDirectiveDeclareNode(ctx);
        if (!directiveConfigNode) {
            return;
        }

        const directiveNameNode = directiveConfigNode.arguments[0];
        return {
            filePath: hoverDirective.filePath,
            start: directiveNameNode.getStart(ctx.sourceFile),
            end: directiveNameNode.getEnd(),
        };
    } else {
        for (const directive of matchedDirectives) {
            const directiveContext = getDirectiveContext(coreCtx, directive);
            if (!directiveContext) {
                continue;
            }

            const { ctx, directiveConfigNode } = directiveContext;

            const scopePropValue = getPropValueByName(ctx, directiveConfigNode, 'scope');
            if (scopePropValue && ctx.ts.isObjectLiteralExpression(scopePropValue)) {
                const p = getProp(
                    ctx,
                    scopePropValue,
                    (p) =>
                        ctx.ts.isIdentifier(p.name) &&
                        ctx.ts.isStringLiteralLike(p.initializer) &&
                        (p.initializer.text.includes(cursorAtAttrName) || p.name.text === cursorAtAttrName),
                );
                if (p) {
                    return {
                        filePath: directive.filePath,
                        start: p.getStart(ctx.sourceFile),
                        end: p.getEnd(),
                    };
                }
            }
        }
    }
}

export function getComponentNameOrAttrNameDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getComponentNameOrAttrNameDefinitionInfo()');

    const componentMap = ngHelperServer.getComponentDirectiveMap(fileName);
    if (!componentMap) {
        return;
    }

    const { filePath, componentNameInfo, directiveNameInfo, transcludeConfig } = findComponentOrDirectiveInfo(componentMap, hoverInfo);
    logger.info(
        'filePath:',
        filePath,
        'componentNameInfo:',
        componentNameInfo,
        'directiveNameInfo:',
        directiveNameInfo,
        'transcludeConfig:',
        transcludeConfig,
    );

    if (!filePath || (!componentNameInfo && !directiveNameInfo)) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, filePath);
    if (!ctx) {
        return;
    }

    if (componentNameInfo) {
        return getFromComponent(ctx, filePath);
    } else if (directiveNameInfo) {
        return getFromDirective(ctx, filePath, directiveNameInfo);
    }

    function getFromDirective(ctx: PluginContext, filePath: string, directiveNameInfo: NgDirectiveNameInfo): NgDefinitionResponse {
        if (hoverInfo.type === 'tagName' && !transcludeConfig) {
            const directiveDeclareNode = getDirectiveDeclareNode(ctx);
            if (!directiveDeclareNode) {
                return;
            }

            const directiveNameNode = directiveDeclareNode.arguments[0];
            return {
                filePath,
                start: directiveNameNode.getStart(ctx.sourceFile),
                end: directiveNameNode.getEnd(),
            };
        }

        const directiveConfigNode = getDirectiveConfigNode(ctx, directiveNameInfo.directiveName);
        if (directiveConfigNode && (hoverInfo.type === 'attrName' || transcludeConfig)) {
            const propName = hoverInfo.type === 'attrName' ? 'scope' : 'transclude';
            const prop = getPropByName(ctx, directiveConfigNode, propName);
            if (prop && ctx.ts.isObjectLiteralExpression(prop.initializer)) {
                const propObj = prop.initializer;
                const p = getProp(
                    ctx,
                    propObj,
                    (p) =>
                        ctx.ts.isIdentifier(p.name) &&
                        ctx.ts.isStringLiteralLike(p.initializer) &&
                        (p.initializer.text.includes(hoverInfo.name) || p.name.text === hoverInfo.name),
                );
                if (p) {
                    return {
                        filePath,
                        start: p.getStart(ctx.sourceFile),
                        end: p.getEnd(),
                    };
                }
            }
        }
    }

    function getFromComponent(ctx: PluginContext, filePath: string): NgDefinitionResponse {
        const componentDeclareNode = getComponentDeclareNode(ctx);
        logger.info('componentDeclareNode', componentDeclareNode?.getText(ctx.sourceFile));
        if (!componentDeclareNode) {
            return;
        }

        if (hoverInfo.type === 'tagName' && !transcludeConfig) {
            const componentNameNode = componentDeclareNode.arguments[0];
            return {
                filePath,
                start: componentNameNode.getStart(ctx.sourceFile),
                end: componentNameNode.getEnd(),
            };
        }

        const componentLiteralObjectNode = componentDeclareNode.arguments[1] as ts.ObjectLiteralExpression;
        if (hoverInfo.type === 'attrName' || transcludeConfig) {
            const propName = hoverInfo.type === 'attrName' ? 'bindings' : 'transclude';
            const prop = getPropByName(ctx, componentLiteralObjectNode, propName);
            if (prop && ctx.ts.isObjectLiteralExpression(prop.initializer)) {
                const propObj = prop.initializer;
                const p = getProp(
                    ctx,
                    propObj,
                    (p) =>
                        ctx.ts.isIdentifier(p.name) &&
                        ctx.ts.isStringLiteralLike(p.initializer) &&
                        (p.initializer.text.includes(hoverInfo.name) || p.name.text === hoverInfo.name),
                );
                if (p) {
                    return {
                        filePath,
                        start: p.getStart(ctx.sourceFile),
                        end: p.getEnd(),
                    };
                }
            }
        }
    }
}

function getDirectiveDeclareNode(ctx: PluginContext): ts.CallExpression | undefined {
    let directiveDeclareNode: ts.CallExpression | undefined;
    visit(ctx.sourceFile);
    return directiveDeclareNode;

    function visit(node: ts.Node) {
        if (isAngularDirectiveRegisterNode(ctx, node)) {
            directiveDeclareNode = node;
        }
        if (!directiveDeclareNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

function getComponentDeclareNode(ctx: PluginContext): ts.CallExpression | undefined {
    let componentDeclareNode: ts.CallExpression | undefined;
    visit(ctx.sourceFile);
    return componentDeclareNode;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            componentDeclareNode = node;
        }
        if (!componentDeclareNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

export function getComponentTypeDefinitionInfo(ctx: PluginContext, { contextString, cursorAt }: NgTypeDefinitionRequest): NgDefinitionResponse {
    const logger = ctx.logger.prefix('getComponentTypeDefinitionInfo()');

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

    // 目前仅支持 ctrl.x 的情况, 不支持 ctrl.x.y 的情况
    const propDeep = minPrefix.split('.').length;
    logger.info('propDeep:', propDeep);
    if (propDeep > 2) {
        return;
    }

    if (info.controllerType) {
        return getTypeDefinitionInfo({
            ctx,
            controllerType: info.controllerType,
            controllerAs: info.controllerAs,
            targetNode,
            propDeep,
        });
    }

    // hover 在根节点上
    if (propDeep === 1 && targetNode.text === info.controllerAs) {
        const controllerAs = getPropByName(ctx, componentLiteralNode, 'controllerAs');
        if (controllerAs) {
            return {
                filePath: ctx.sourceFile.fileName,
                start: controllerAs.getStart(ctx.sourceFile),
                end: controllerAs.getEnd(),
            };
        } else {
            return {
                filePath: ctx.sourceFile.fileName,
                start: componentLiteralNode.getStart(ctx.sourceFile),
                end: componentLiteralNode.getEnd(),
            };
        }
    } else if (info.bindings.get(targetNode.text)) {
        const bindings = getPropByName(ctx, componentLiteralNode, 'bindings');
        if (!bindings || !ctx.ts.isObjectLiteralExpression(bindings.initializer)) {
            return;
        }

        const prop = getPropByName(ctx, bindings.initializer, targetNode.text);
        if (!prop) {
            return;
        }

        return {
            filePath: ctx.sourceFile.fileName,
            start: prop.getStart(ctx.sourceFile),
            end: prop.getEnd(),
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
            (m) => (ctx.ts.isPropertyDeclaration(m) || ctx.ts.isMethodDeclaration(m)) && m.name.getText() === targetNode.text,
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

export function getControllerTypeDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, controllerName, controllerAs, contextString, cursorAt }: NgCtrlTypeDefinitionRequest,
): NgDefinitionResponse {
    const logger = coreCtx.logger.prefix('getControllerTypeDefinitionInfo()');

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

    // 目前仅支持 ctrl.x 的情况, 不支持 ctrl.x.y 的情况
    const propDeep = minPrefix.split('.').length;
    logger.info('propDeep:', propDeep);
    if (propDeep > 2) {
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
