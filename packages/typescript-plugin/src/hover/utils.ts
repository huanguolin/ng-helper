import { NgHoverInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import { PluginContext } from '../type';
import { getSymbolDocument, typeToString } from '../utils/common';

export function buildHoverInfo({
    ctx,
    targetType,
    name,
    parentType,
}: {
    ctx: PluginContext;
    targetType: ts.Type;
    name: string;
    parentType?: ts.Type;
}): NgHoverInfo {
    let typeKind = 'property';
    if (targetType.isClass()) {
        typeKind = 'class';
    } else if (targetType.getCallSignatures().length > 0) {
        typeKind = 'method';
    }

    let document = '';
    if (parentType) {
        const memberSymbol = parentType.getProperty(name);
        if (memberSymbol && memberSymbol.valueDeclaration) {
            document = getSymbolDocument(ctx, memberSymbol);
        }
    }

    return {
        formattedTypeString: `(${typeKind}) ${name}: ${formatTypeString(ctx, targetType)}`,
        document,
    };
}

export function formatTypeString(ctx: PluginContext, type: ts.Type): string {
    const formatFlags = ctx.ts.TypeFormatFlags.NoTruncation | ctx.ts.TypeFormatFlags.NoTypeReduction;
    // typeToString 无法处理换行美化，所以要用 beautifyTypeString 处理一下
    const typeString = typeToString(ctx, type, formatFlags);
    return beautifyTypeString(typeString ?? 'any');
}

export function beautifyTypeString(typeString: string): string {
    const beautifulLines: string[] = [];
    const indentUnitCnt = 4;
    let index = 0;
    let indent = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { line, endCh } = getLine();
        if (!line) {
            break;
        }

        if (endCh === '{') {
            appendLine(line);
            indent += indentUnitCnt;
        } else if (endCh === '}' || endCh === '};') {
            indent -= indentUnitCnt;
            appendLine(line);
        } else {
            appendLine(line);
        }
    }
    return beautifulLines.join('\n');

    function getLine(): { line: string; endCh: string } {
        const start = index;
        while (index < typeString.length) {
            const ch = typeString[index];
            if (ch === '}' && typeString[index + 1] === ';') {
                index += 2;
                return {
                    line: typeString.slice(start, index),
                    endCh: '};',
                };
            } else if (ch === '{' || ch === '}' || ch === ';') {
                index += 1;
                return {
                    line: typeString.slice(start, index),
                    endCh: ch,
                };
            } else {
                index += 1;
            }
        }
        return {
            line: typeString.slice(start),
            endCh: '',
        };
    }

    function appendLine(line: string) {
        beautifulLines.push(' '.repeat(indent) + line.trim());
    }
}