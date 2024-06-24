import type ts from "typescript";
import { PluginContext } from "./type";
import { buildLogMsg, listPublicMembers } from "./utils";

export function getComponentCompletions(ctx: PluginContext): string[] | undefined {
    if (!ctx.sourceFile) {
        return;
    }

    try {
        ctx.logger.info(buildLogMsg('start find controller type'));
        const ct = findControllerType(ctx);
        if (ct) {
            const res = listPublicMembers(ctx, ct);
            ctx.logger.info(buildLogMsg('resolve:', res));
            return res;
        }
    } catch (error) {
        ctx.logger.info(buildLogMsg('getComponentCompletions error: ', (error as any)?.message));
    }
    return;
}

function findControllerType(ctx: PluginContext): ts.Type | undefined {
    let controllerType: ts.Type | undefined;
    visit(ctx.sourceFile);
    return controllerType;

    function visit(node: ts.Node) {
        // 查找对象字面量
        if (isAngularComponentRegisterNode(ctx, node)) {
            ctx.logger.info(buildLogMsg('find angular component:'));
            let objNode = node.arguments[1];
            ctx.logger.info(buildLogMsg('objNode:'));
            if (ctx.ts.isObjectLiteralExpression(objNode)) {
                for (const prop of objNode.properties) {
                    if (ctx.ts.isPropertyAssignment(prop) && ctx.ts.isIdentifier(prop.name)) {
                        if (prop.name.text === 'controller' && ctx.ts.isIdentifier(prop.initializer)) {
                            const typeChecker = ctx.typeChecker;
                            const symbol = typeChecker.getSymbolAtLocation(prop.initializer);
                            if (symbol) {
                                controllerType = typeChecker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
                                if (controllerType.isClass()) {
                                    return;
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