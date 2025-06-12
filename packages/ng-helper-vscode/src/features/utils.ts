import os from 'node:os';

import type { CursorAtAttrValueInfo, CursorAtTemplateInfo } from '@ng-helper/shared/lib/cursorAt';
import type { CursorAtContext, CursorAtInfo } from '@ng-helper/shared/lib/cursorAt';
import { isHtmlTagName } from '@ng-helper/shared/lib/html';
import { getMinNgSyntaxInfo, isAttrHasScope, type MinNgSyntaxInfo } from '@ng-helper/shared/lib/minNgSyntax';
import { getNgScopes } from '@ng-helper/shared/lib/ngScope';
import { NgCtrlInfo, NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import fuzzysort from 'fuzzysort';
import { Range, TextDocument, Uri, type Position } from 'vscode';

import { logger } from '../logger';
import { getScriptFiles, isFileExistsOnWorkspace, normalizePath } from '../utils';

export function isInlinedHtml(document: TextDocument): boolean {
    const fileName = document.fileName;
    return fileName.endsWith('.ts.html') || fileName.endsWith('.js.html');
}

export function isComponentHtml(document: TextDocument): boolean {
    const fileName = document.fileName;
    if (isInlinedHtml(document)) {
        return fileName.endsWith('.component.ts.html') || fileName.endsWith('component.js.html');
    }
    return fileName.endsWith('.component.html');
}

export function getControllerNameInfo(cursorAtContext: CursorAtContext[]): NgCtrlInfo | undefined {
    const ngController = cursorAtContext.find((x) => x.kind === 'ng-controller');
    if (ngController) {
        const result: NgCtrlInfo = getNgCtrlInfo(ngController.value);
        return result;
    }
}

export function getNgCtrlInfo(text: string): NgCtrlInfo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [controllerName, asKey, controllerAs] = text.split(/\s+/);
    return {
        controllerName,
        controllerAs,
    };
}

/**
 * 这个考虑了嵌入式文档等情况。
 */
export function getNormalizedPathFromDocument(document: TextDocument): string {
    let filePath = document.fileName;
    if (isInlinedHtml(document)) {
        const originalPath = getOriginalFileName(document.fileName);
        if (os.platform() === 'win32') {
            // Here do not use normalizePath()
            filePath = originalPath.replace(/\\/g, '/').slice('file:///'.length);
        } else {
            filePath = originalPath.slice('file://'.length);
        }
    }
    return normalizePath(filePath);
}

export function getOriginalFileName(fileName: string): string {
    // Remove leading `/` and ending `.html` to get original path.
    // for example:
    // input: /file:///d:/workdir/test/app/xyz.ts.html'
    // output: file:///d:/workdir/test/app/xyz.ts
    const originalPath = fileName.slice(1).slice(0, -5);
    return originalPath;
}

export async function getCorrespondingScriptFileName(
    document: TextDocument,
    searchKey?: string,
): Promise<string | undefined> {
    const filePath = getNormalizedPathFromDocument(document);

    if (isComponentHtml(document)) {
        // remove .html add .ts
        const tsFilePath = filePath.slice(0, -5) + '.ts';
        if (await isFileExistsOnWorkspace(Uri.file(tsFilePath))) {
            return tsFilePath;
        }

        // remove .html add .js
        const jsFilePath = filePath.slice(0, -5) + '.js';
        if (await isFileExistsOnWorkspace(Uri.file(jsFilePath))) {
            return jsFilePath;
        }
    }

    const scriptFiles = await getScriptFiles(filePath, { fallbackCnt: 4, limit: searchKey ? undefined : 1 });
    if (searchKey) {
        const result = fuzzysort.go(searchKey, scriptFiles, { limit: 1 });
        if (result.length) {
            const scriptFilePath = result[0].target;
            logger.logInfo('getCorrespondingTsFileName() fuzzy search result:', scriptFilePath);
            return scriptFilePath;
        }
    }

    return scriptFiles[0];
}

/**
 * Retrieves the component name(camelCase) from the given document.
 *
 * @param document - The TextDocument object representing the document.
 * @returns The component name (camelCase) if the document is a component HTML file, otherwise undefined.
 */
export function getComponentName(document: TextDocument): string | undefined {
    if (!isComponentHtml(document)) {
        return;
    }

    const fileName = normalizePath(document.fileName).split('/').pop();
    const suffix = isInlinedHtml(document) ? '.component.ts.html' : '.component.html';
    const kebabName = fileName?.replace(suffix, '');
    return kebabName ? camelCase(kebabName) : undefined;
}

export function isNgBuiltinDirective(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isNgUserCustomAttr(attrName: string): boolean {
    return (
        !isNgBuiltinDirective(attrName) &&
        attrName.includes('-') &&
        !attrName.startsWith('data-') &&
        attrName !== 'accept-charset'
    );
}

export const BUILTIN_FILTER_NAMES = [
    'currency',
    'date',
    'filter',
    'json',
    'limitTo',
    'lowercase',
    'number',
    'orderBy',
    'uppercase',
    'translate',
] as const;
export type BuiltinFilterNames = (typeof BUILTIN_FILTER_NAMES)[number];
export function isBuiltinFilter(filterName: string): boolean {
    return BUILTIN_FILTER_NAMES.includes(filterName as BuiltinFilterNames);
}

export function isValidIdentifier(text: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z\d_$]*$/.test(text);
}

export function isValidIdentifierChar(char: string): boolean {
    return /^[a-zA-Z\d_$]*$/.test(char);
}

export function isHoverValidIdentifierChar(document: TextDocument, position: Position): boolean {
    const ch = getCursorAtChar(document, position);
    return isValidIdentifierChar(ch);
}

export function getCursorAtChar(document: TextDocument, position: Position): string {
    return document.getText(new Range(position, position.translate(0, 1)));
}

export function isComponentTagName(name: string): boolean {
    return name.includes('-') || !isHtmlTagName(name);
}

export function toNgElementHoverInfo(cursorAtInfo: CursorAtInfo): NgElementHoverInfo {
    const { type } = cursorAtInfo;
    if (type !== 'tagName' && type !== 'attrName') {
        throw new Error('Only "tagName" or "attrName" can convert!');
    }

    return {
        type,
        name: camelCase(type === 'attrName' ? cursorAtInfo.cursorAtAttrName : cursorAtInfo.tagName),
        tagName: camelCase(cursorAtInfo.tagName),
        attrNames: cursorAtInfo.attrNames.map((x) => camelCase(x)),
        parentTagName: cursorAtInfo.parentTagName ? camelCase(cursorAtInfo.parentTagName) : undefined,
    };
}

let cnt = 0;
export function getContextString(cursorAtInfo: CursorAtAttrValueInfo | CursorAtTemplateInfo): MinNgSyntaxInfo {
    const isAttrValue = cursorAtInfo.type === 'attrValue';
    const sourceText = isAttrValue ? cursorAtInfo.attrValue : cursorAtInfo.template;
    const attrName = isAttrValue ? cursorAtInfo.attrName : undefined;
    cnt++;
    const label = `getMinNgSyntaxInfo()#${cnt}`;
    console.time(label);
    let minNgSyntaxInfo = getMinNgSyntaxInfo(
        sourceText,
        cursorAtInfo.relativeCursorAt,
        isAttrValue && isAttrHasScope(attrName) ? attrName : undefined,
    );
    minNgSyntaxInfo = reshapeMinNgSyntaxInfo(minNgSyntaxInfo, cursorAtInfo.context);
    console.timeEnd(label);
    return minNgSyntaxInfo;
}

function reshapeMinNgSyntaxInfo({ type, value }: MinNgSyntaxInfo, context: CursorAtContext[]): MinNgSyntaxInfo {
    const result: MinNgSyntaxInfo = { type, value };

    if (type !== 'identifier' && type !== 'propertyAccess') {
        return result;
    }

    const scopes = getNgScopes(context);
    for (const scope of scopes) {
        if (scope.kind === 'ng-repeat' && scope.vars.length > 0) {
            for (const scopeVar of scope.vars) {
                if (type === 'identifier' && value === scopeVar.name) {
                    if (scopeVar.replaceTo) {
                        result.value = scopeVar.replaceTo;
                        result.cursorAt = -1;
                        result.hoverPropName = value;
                    }

                    if (scopeVar.typeString) {
                        result.typeString = scopeVar.typeString;
                    }

                    if (scopeVar.location) {
                        result.location = scopeVar.location;
                    }

                    return result;
                } else if (type === 'propertyAccess' && value.startsWith(scopeVar.name + '.')) {
                    if (scopeVar.replaceTo) {
                        result.value = value.replace(scopeVar.name, scopeVar.replaceTo);
                    }
                    return result;
                }
            }
        }
    }
    return result;
}
