import type ts from "typescript";
import { PluginContext } from "./type";
import { buildLogMsg, listPublicMembers } from "./utils";
import { CompletionResponse } from "@ng-helper/shared/lib/plugin";

export function getComponentCompletions(ctx: PluginContext): CompletionResponse{
    if (!ctx.sourceFile) {
        return;
    }

    try {
        const ct = findControllerType(ctx);
        if (ct) {
            const res = listPublicMembers(ctx, ct);
            return res;
        }
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentCompletions error: ', (error as any)?.message));
    }
}

function findControllerType(ctx: PluginContext): ts.Type | undefined {
    let controllerType: ts.Type | undefined;
    visit(ctx.sourceFile);
    return controllerType;

    function visit(node: ts.Node) {
        if (isAngularComponentRegisterNode(ctx, node)) {
            // 第二个参数是对象字面量
            let objNode = node.arguments[1];
            if (ctx.ts.isObjectLiteralExpression(objNode)) {
                for (const prop of objNode.properties) {
                    if (ctx.ts.isPropertyAssignment(prop) && ctx.ts.isIdentifier(prop.name)) {
                        if (prop.name.text === 'controller' && ctx.ts.isIdentifier(prop.initializer)) {
                            const typeChecker = ctx.typeChecker;
                            const symbol = typeChecker.getSymbolAtLocation(prop.initializer);
                            if (symbol) {
                                controllerType = typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
                                if (controllerType.isClass()) {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (!controllerType) {
            ctx.ts.forEachChild(node, visit);
        }
    }
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