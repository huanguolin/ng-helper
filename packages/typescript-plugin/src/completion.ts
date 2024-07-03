import type ts from "typescript";
import { PluginContext } from "./type";
import { buildLogMsg, buildCompletionViaSymbolMembers, buildCompletionFromBindings, getMinSyntaxNodeForCompletion, getCompletionType, buildCompletionResponse } from "./utils";
import { NgCompletionResponse } from "@ng-helper/shared/lib/plugin";

export function getComponentControllerAs(ctx: PluginContext): string | undefined {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const componentLiteralNode = getComponentLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentCoreInfo(ctx, componentLiteralNode);
        return info.controllerAs;
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentControllerAs error:', (error as any)?.message));
    }
}

export function getComponentCompletions(ctx: PluginContext, prefix: string): NgCompletionResponse {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const componentLiteralNode = getComponentLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const minSyntaxNode = getMinSyntaxNodeForCompletion(ctx, prefix);
        if (!minSyntaxNode) {
            ctx.logger.info(buildLogMsg('getComponentCompletions minSyntaxNode not found'));
            return;
        }

        const minPrefix = minSyntaxNode.node.getText(minSyntaxNode.sourceFile);
        ctx.logger.info(buildLogMsg('getComponentCompletions minPrefix:', minPrefix));
        const info = getComponentCoreInfo(ctx, componentLiteralNode);
        if (!minPrefix.startsWith(info.controllerAs)) {
            return;
        }

        ctx.logger.info(buildLogMsg('getComponentCompletions minPrefix:', minPrefix));

        // ctrl. 的情况
        if (minPrefix === info.controllerAs + '.') {
            ctx.logger.info(buildLogMsg('getComponentCompletions ctrl.'));
            return info.controllerType ? buildCompletionViaSymbolMembers(ctx, info.controllerType) : buildCompletionFromBindings(ctx, info.bindings);
        }

        ctx.logger.info(buildLogMsg('getComponentCompletions using getCompletionType'));
        if (info.controllerType) {
            ctx.logger.info(buildLogMsg('getComponentCompletions controllerType:', ctx.typeChecker.typeToString(info.controllerType)));
            const targetType = getCompletionType(ctx, info.controllerType, minSyntaxNode);
            if (!targetType) return;

            ctx.logger.info(buildLogMsg('getComponentCompletions getCompletionType targetType:', ctx.typeChecker.typeToString(targetType)));
            return buildCompletionResponse(ctx, targetType);
        }
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentCompletions error:', (error as any)?.message));
    }
}

function getComponentLiteralNode(ctx: PluginContext): ts.ObjectLiteralExpression | undefined {
    let componentLiteralNode: ts.ObjectLiteralExpression | undefined;
    visit(ctx.sourceFile);
    return componentLiteralNode;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            // 第二个参数是对象字面量
            const theNode = node.arguments[1];
            if (ctx.ts.isObjectLiteralExpression(theNode)) {
                componentLiteralNode = theNode;
            }
        }
        if (!componentLiteralNode) {
            ctx.ts.forEachChild(node, visit);
        }
    }
}

function getComponentCoreInfo(ctx: PluginContext, componentLiteralNode: ts.ObjectLiteralExpression): ComponentCoreInfo {
    const result: ComponentCoreInfo = {
        controllerAs: '$ctrl',
        bindings: new Map(),
    };
    for (const prop of componentLiteralNode.properties) {
        if (ctx.ts.isPropertyAssignment(prop) && ctx.ts.isIdentifier(prop.name)) {
            if (prop.name.text === 'controller' && ctx.ts.isIdentifier(prop.initializer)) {
                result.controllerType = ctx.typeChecker.getTypeAtLocation(prop.initializer);
            } else if (prop.name.text === 'controllerAs' && ctx.ts.isStringLiteral(prop.initializer)) {
                result.controllerAs = prop.initializer.text;
            } else if (prop.name.text === 'bindings' && ctx.ts.isObjectLiteralExpression(prop.initializer)) {
                for (const f of prop.initializer.properties) {
                    if (ctx.ts.isPropertyAssignment(f)
                        && ctx.ts.isIdentifier(f.name)
                        && ctx.ts.isStringLiteral(f.initializer)
                    ) {
                        result.bindings.set(f.name.text, f.initializer.text);
                    }
                }
            }
        }
    }
    return result;
}

function isAngularComponentRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    if (ctx.ts.isCallExpression(node)
        && ctx.ts.isPropertyAccessExpression(node.expression)
        && ctx.ts.isCallExpression(node.expression.expression)
        && ctx.ts.isIdentifier(node.expression.name)
        && node.expression.name.text === 'component'
        && node.arguments.length === 2
        && ctx.ts.isStringLiteral(node.arguments[0])
        && ctx.ts.isObjectLiteralExpression(node.arguments[1])
    ) {
        return true;
    }
    return false;
}

type ComponentCoreInfo = {
    controllerAs: string;
    controllerType?: ts.Type;
    bindings: Map<string, string>;
};