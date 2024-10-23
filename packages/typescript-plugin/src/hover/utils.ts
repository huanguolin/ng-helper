import { NgHoverInfo, type NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import type ts from 'typescript';

import type { NgCache, DirectiveInfo, ComponentInfo } from '../ngHelperServer/ngCache';
import { getCtxOfCoreCtx } from '../ngHelperServer/utils';
import { PluginContext, SyntaxNodeInfoEx, type CorePluginContext } from '../type';
import { createTmpSourceFile, getNodeAtPosition, getSymbolDocument, typeToString } from '../utils/common';
import { getDirectiveConfigNode, isElementDirective } from '../utils/ng';

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

export function getMinSyntaxNodeForHover(ctx: PluginContext, contextString: string, cursorAt: number): SyntaxNodeInfoEx | undefined {
    const sourceFile = createTmpSourceFile(ctx, contextString, 'tmp', /* setParentNodes */ true);
    const node = getNodeAtPosition(ctx, cursorAt, sourceFile);

    if (!node) {
        return;
    }

    if (node.parent && ctx.ts.isPropertyAccessExpression(node.parent) && node !== node.parent.expression) {
        return { sourceFile, minNode: node.parent, targetNode: node };
    } else {
        return { sourceFile, minNode: node, targetNode: node };
    }
}

/**
 * 查找组件或指令（用作元素使用时）信息
 * @param cache 缓存
 * @param hoverInfo 元素悬停信息
 * @returns 组件或指令信息
 */
export function findComponentOrDirectiveInfo(
    cache: NgCache,
    hoverInfo: NgElementHoverInfo,
): {
    componentInfo?: ComponentInfo;
    directiveInfo?: DirectiveInfo;
    transcludeConfig?: string;
} {
    const componentMap = cache.getComponentMap();
    if (componentMap.has(hoverInfo.tagName)) {
        return { componentInfo: componentMap.get(hoverInfo.tagName) };
    }

    const directiveMap = cache.getDirectiveMap();
    if (directiveMap.has(hoverInfo.tagName)) {
        const directiveInfo = directiveMap.get(hoverInfo.tagName)!;
        if (isElementDirective(directiveInfo)) {
            return { directiveInfo };
        }
    }

    if (hoverInfo.parentTagName) {
        if (directiveMap.has(hoverInfo.parentTagName)) {
            const directiveInfo = directiveMap.get(hoverInfo.parentTagName)!;
            if (isElementDirective(directiveInfo) && Array.isArray(directiveInfo.transclude) && directiveInfo.transclude.length > 0) {
                for (const item of directiveInfo.transclude) {
                    const transcludeElementName = item.value.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { directiveInfo, transcludeConfig: item.value };
                    }
                }
            }
        }
        if (componentMap.has(hoverInfo.parentTagName)) {
            const componentInfo = componentMap.get(hoverInfo.parentTagName)!;
            if (Array.isArray(componentInfo.transclude) && componentInfo.transclude.length > 0) {
                for (const item of componentInfo.transclude) {
                    const transcludeElementName = item.value.replace('?', '').trim();
                    if (transcludeElementName === hoverInfo.tagName) {
                        return { componentInfo, transcludeConfig: item.value };
                    }
                }
            }
        }
    }

    return {};
}

export function getDirectiveContext(coreCtx: CorePluginContext, directive: DirectiveInfo) {
    const ctx = getCtxOfCoreCtx(coreCtx, directive.filePath);
    if (!ctx) {
        return null;
    }

    const directiveConfigNode = getDirectiveConfigNode(ctx, directive.name);
    if (!directiveConfigNode) {
        return null;
    }

    return { ctx, directiveConfigNode };
}
