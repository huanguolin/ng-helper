import type ts from 'typescript';

import { PluginContext } from '../type';

export function getStaticPublicInjectionField(ctx: PluginContext, classNode: ts.ClassDeclaration): ts.PropertyDeclaration | undefined {
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

export function getConstructor(ctx: PluginContext, classNode: ts.ClassDeclaration): ts.ConstructorDeclaration | undefined {
    return classNode.members.find((member) => {
        return ctx.ts.isConstructorDeclaration(member);
    }) as ts.ConstructorDeclaration;
}
