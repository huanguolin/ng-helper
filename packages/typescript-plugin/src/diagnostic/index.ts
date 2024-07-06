import type ts from 'typescript';

import { PluginContext } from '../type';
import { findClassDeclaration } from '../utils/common';

import { getConstructor, getStaticPublicInjectionField } from './utils';

export function getTsInjectionDiagnostics(ctx: PluginContext): ts.Diagnostic[] | undefined {
    const logger = ctx.logger.prefix('getTsInjectionDiagnostics()');
    const classNode = findClassDeclaration(ctx, ctx.sourceFile);
    if (!classNode) {
        return;
    }

    const staticInjectField = getStaticPublicInjectionField(ctx, classNode);
    if (!staticInjectField) {
        logger.info('miss staticInjectField');
        return;
    }

    const constructor = getConstructor(ctx, classNode);
    if (!constructor) {
        logger.info('miss constructor');
        return;
    }

    // 暂不考虑不合理的情况
    if (!staticInjectField.initializer || !ctx.ts.isArrayLiteralExpression(staticInjectField.initializer)) {
        logger.info('miss staticInjectField.initializer');
        return;
    }

    const injectionArray = staticInjectField.initializer.elements;
    const constructorParams = constructor.parameters;
    if (injectionArray.length === 0 && constructorParams.length === 0) {
        logger.info('no injection');
        return;
    }

    const result: ts.Diagnostic[] = [];

    if (injectionArray.length === 0) {
        const { left, right } = getConstructorParenPosition(ctx, constructor);
        result.push(
            buildDiagnostic({
                category: ctx.ts.DiagnosticCategory.Error,
                code: 0,
                file: ctx.sourceFile,
                start: left,
                length: right - left + 1,
                messageText: 'Constructor parameters do not match $inject.',
            }),
        );
    } else if (constructorParams.length === 0) {
        const { left, right } = getConstructorParenPosition(ctx, constructor);
        result.push(
            buildDiagnostic({
                category: ctx.ts.DiagnosticCategory.Error,
                code: 0,
                file: ctx.sourceFile,
                start: left,
                length: right - left + 1,
                messageText: 'Constructor parameters do not match $inject.',
            }),
        );
    } else {
        for (let i = 0; i < Math.min(injectionArray.length, constructorParams.length); i++) {
            const injectEle = injectionArray[i];
            const param = constructorParams[i];

            if (!ctx.ts.isStringLiteral(injectEle)) {
                result.push(
                    buildDiagnostic({
                        category: ctx.ts.DiagnosticCategory.Error,
                        code: 0,
                        file: ctx.sourceFile,
                        start: injectEle.getStart(ctx.sourceFile),
                        length: injectEle.getWidth(ctx.sourceFile),
                        messageText: '$inject element must be literal string.',
                    }),
                );
                break;
            }

            if (injectEle.text.toLowerCase() !== param.name.getText(ctx.sourceFile).toLowerCase()) {
                result.push(
                    buildDiagnostic({
                        category: ctx.ts.DiagnosticCategory.Error,
                        code: 0,
                        file: ctx.sourceFile,
                        start: param.getStart(ctx.sourceFile),
                        length: param.getWidth(ctx.sourceFile),
                        messageText: 'Constructor parameter not match $inject element.',
                    }),
                );
                break;
            }
        }
    }

    logger.info('miss staticInjectField.initializer');
    return result;

    function buildDiagnostic(input: ts.Diagnostic): ts.Diagnostic {
        return {
            ...input,
            messageText: `[ng-helper] ${input.messageText as string}`,
        };
    }
}

function getConstructorParenPosition(ctx: PluginContext, constructor: ts.ConstructorDeclaration): { left: number; right: number } {
    const constructorStartAt = constructor.getStart(ctx.sourceFile);
    const constructorText = constructor.getText(ctx.sourceFile);
    // 获取左括号的位置
    const left = constructorStartAt + constructorText.indexOf('(');
    // 获取右括号的位置
    const right = constructorStartAt + constructorText.indexOf(')');
    return { left, right };
}
