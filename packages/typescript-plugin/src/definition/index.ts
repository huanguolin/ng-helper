import { type NgComponentNameOrAttrNameDefinitionRequest, type NgDefinitionResponse } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { findComponentInfo } from '../hover/utils';
import { getCtxOfCoreCtx, ngHelperServer } from '../ngHelperServer';
import { CorePluginContext, type PluginContext } from '../type';
import { isAngularComponentRegisterNode } from '../utils/ng';

export function getComponentNameOrAttrNameDefinitionInfo(
    coreCtx: CorePluginContext,
    { fileName, hoverInfo }: NgComponentNameOrAttrNameDefinitionRequest,
): NgDefinitionResponse {
    ngHelperServer.refreshInternalMaps(fileName);

    const logger = coreCtx.logger.prefix('getComponentNameOrAttrNameDefinitionInfo');

    const componentMap = ngHelperServer.getComponentMap(fileName);
    if (!componentMap) {
        return;
    }

    const { componentFilePath, componentFileInfo, transcludeConfig } = findComponentInfo(componentMap, hoverInfo);
    logger.info('componentFilePath:', componentFilePath, 'componentFileInfo:', componentFileInfo, 'transcludeConfig:', transcludeConfig);

    if (!componentFilePath || !componentFileInfo) {
        return;
    }

    const ctx = getCtxOfCoreCtx(coreCtx, componentFilePath);
    if (!ctx) {
        return;
    }

    const componentDeclareNode = getComponentDeclareNode(ctx);
    logger.info('componentDeclareNode', componentDeclareNode?.getText(ctx.sourceFile));
    if (!componentDeclareNode) {
        return;
    }

    if (hoverInfo.type === 'tagName' && !transcludeConfig) {
        const componentNameNode = componentDeclareNode.arguments[0];
        return {
            filePath: componentFilePath,
            start: componentNameNode.getStart(ctx.sourceFile),
            end: componentNameNode.getEnd(),
        };
    }

    const componentLiteralObjectNode = componentDeclareNode.arguments[1] as ts.ObjectLiteralExpression;
    if (hoverInfo.type === 'attrName' || transcludeConfig) {
        const propName = hoverInfo.type === 'attrName' ? 'bindings' : 'transclude';
        const prop = getPropOfObjectLiteral(ctx, componentLiteralObjectNode, (p) => ctx.ts.isIdentifier(p.name) && p.name.text === propName);
        if (prop && ctx.ts.isObjectLiteralExpression(prop.initializer)) {
            const propObj = prop.initializer;
            const p = getPropOfObjectLiteral(
                ctx,
                propObj,
                (p) =>
                    ctx.ts.isIdentifier(p.name) &&
                    ctx.ts.isStringLiteralLike(p.initializer) &&
                    (p.initializer.text.includes(hoverInfo.name) || p.name.text === hoverInfo.name),
            );
            if (p) {
                return {
                    filePath: componentFilePath,
                    start: p.getStart(ctx.sourceFile),
                    end: p.getEnd(),
                };
            }
        }
    }
}

function getPropOfObjectLiteral(
    ctx: PluginContext,
    obj: ts.ObjectLiteralExpression,
    predicate: (p: ts.PropertyAssignment) => boolean,
): ts.PropertyAssignment | undefined {
    return obj.properties.find((p) => ctx.ts.isPropertyAssignment(p) && predicate(p)) as ts.PropertyAssignment | undefined;
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
