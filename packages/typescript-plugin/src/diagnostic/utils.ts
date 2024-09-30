import type ts from 'typescript';

import { PluginContext } from '../type';
import { isAngularModuleNode } from '../utils/ng';

export function isAngularFile(ctx: PluginContext): boolean {
    let isAngular = false;
    visit(ctx.sourceFile);
    return isAngular;

    function visit(node: ts.Node) {
        if (isAngularModuleNode(ctx, node)) {
            isAngular = true;
        }

        if (!isAngular) {
            node.forEachChild(visit);
        }
    }
}

export function getStaticPublicInjectionField(ctx: PluginContext, classNode: ts.ClassLikeDeclarationBase): ts.PropertyDeclaration | undefined {
    return classNode.members.find((member) => {
        return (
            ctx.ts.isPropertyDeclaration(member) &&
            ctx.ts.getCombinedModifierFlags(member) & ctx.ts.ModifierFlags.Static &&
            !(ctx.ts.getCombinedModifierFlags(member) & ctx.ts.ModifierFlags.NonPublicAccessibilityModifier) &&
            ctx.ts.isIdentifier(member.name) &&
            member.name.text === '$inject'
        );
    }) as ts.PropertyDeclaration;
}

export function getConstructor(ctx: PluginContext, classNode: ts.ClassLikeDeclarationBase): ts.ConstructorDeclaration | undefined {
    return classNode.members.find((member) => {
        return ctx.ts.isConstructorDeclaration(member);
    }) as ts.ConstructorDeclaration;
}
