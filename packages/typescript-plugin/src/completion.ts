import type ts from "typescript";
import { PluginContext } from "./type";
import { buildLogMsg, buildCompletionFromPublicMembers, buildCompletionFromBindings } from "./utils";
import { CompletionResponse } from "@ng-helper/shared/lib/plugin";

export function getComponentCompletions(ctx: PluginContext, prefix: string): CompletionResponse {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const componentLiteralNode = getComponentLiteralNode(ctx);
        if (!componentLiteralNode) {
            return;
        }

        const info = getComponentCoreInfo(ctx, componentLiteralNode);
        if (!prefix.startsWith(info.controllerAs)) {
            return;
        }

        if (info.controllerType) {
            const items = buildCompletionFromPublicMembers(ctx, info.controllerType);
            if (items) {
                // 把 init 函数删除，因为它不会给 component html 用
                const initFnIndex = items.findIndex(x => x.name === 'init' && x.kind === 'method');
                if (initFnIndex >= 0) {
                    items.splice(initFnIndex, 1);
                }
            }
            return items;
        }

        return buildCompletionFromBindings(ctx, info.bindings);
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
                const symbol = ctx.typeChecker.getSymbolAtLocation(prop.initializer);
                if (symbol && symbol.valueDeclaration) {
                    const controllerType = ctx.typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration);
                    result.controllerType = controllerType;
                }
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