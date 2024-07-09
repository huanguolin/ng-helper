import { NgTypeInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { ComponentCoreInfo, PluginContext } from '../type';

export function isAngularComponentRegisterNode(ctx: PluginContext, node: ts.Node): node is ts.CallExpression {
    if (
        ctx.ts.isCallExpression(node) &&
        ctx.ts.isPropertyAccessExpression(node.expression) &&
        ctx.ts.isCallExpression(node.expression.expression) &&
        ctx.ts.isIdentifier(node.expression.name) &&
        node.expression.name.text === 'component' &&
        node.arguments.length === 2 &&
        ctx.ts.isStringLiteral(node.arguments[0]) &&
        ctx.ts.isObjectLiteralExpression(node.arguments[1])
    ) {
        return true;
    }
    return false;
}

export function getComponentCoreInfo(ctx: PluginContext, componentLiteralNode: ts.ObjectLiteralExpression): ComponentCoreInfo {
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
                    if (ctx.ts.isPropertyAssignment(f) && ctx.ts.isIdentifier(f.name) && ctx.ts.isStringLiteral(f.initializer)) {
                        result.bindings.set(f.name.text, f.initializer.text);
                    }
                }
            }
        }
    }
    return result;
}

export function getComponentDeclareLiteralNode(ctx: PluginContext): ts.ObjectLiteralExpression | undefined {
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

export function getPublicMembersTypeInfoOfBindings(ctx: PluginContext, bindingsMap: Map<string, string>): NgTypeInfo[] | undefined {
    if (!bindingsMap.size) {
        return;
    }

    const result: NgTypeInfo[] = [];
    for (const [k, v] of bindingsMap) {
        const typeInfo = getBindType(v);
        const item: NgTypeInfo = {
            kind: 'property',
            name: k,
            typeString: typeInfo.typeString,
            document: `bindings config: ${v}`,
            isFunction: false,
        };
        if (typeInfo.type === 'function') {
            result.push({
                ...item,
                kind: 'method',
                isFunction: true,
                paramNames: [],
            });
        } else {
            result.push(item);
        }
    }
    return result;

    function getBindType(s: string) {
        const result: {
            type: 'unknown' | 'string' | 'function';
            optional: boolean;
            typeString: string;
        } = {
            type: 'unknown',
            optional: s.includes('?'),
            typeString: 'unknown',
        };

        if (s.includes('@')) {
            result.type = 'string';
            result.typeString = 'string';
        } else if (s.includes('&')) {
            result.type = 'function';
            result.typeString = '(...args: unknown[]) => unknown';
        }

        return result;
    }
}

export function isComponentTsFile(fileName: string): boolean {
    return fileName.endsWith('.component.ts');
}

export function isControllerTsFile(fileName: string): boolean {
    return fileName.endsWith('.controller.ts');
}

export function isServiceTsFile(fileName: string): boolean {
    return fileName.endsWith('.service.ts');
}
