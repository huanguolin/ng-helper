import os from 'node:os';

import { getHtmlTagAt, isHtmlTagName } from '@ng-helper/shared/lib/html';
import { NgCtrlInfo, NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import fuzzysort from 'fuzzysort';
import { TextDocument } from 'vscode';

import { checkNgHelperServerRunning, getTsFiles, normalizePath } from '../utils';

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

export function getHoveredTagNameOrAttr(document: TextDocument, cursorAt: number): NgElementHoverInfo | undefined {
    const docText = document.getText();
    const tag = getHtmlTagAt(docText, { at: cursorAt, isHover: true });
    if (!tag) {
        return;
    }

    const tagName = camelCase(tag.tagName);
    const parentTagName = tag.parent?.tagName && camelCase(tag.parent?.tagName);
    const attrNames = tag.attrs.sort((a, b) => a.name.start - b.name.start).map((x) => camelCase(x.name.text));

    const hoverAtStartTagName = cursorAt > tag.start && cursorAt <= tag.start + tag.tagName.length;
    const hoverAtEndTagName = tag.endTagStart !== undefined && cursorAt > tag.endTagStart + 1 && cursorAt < tag.end;
    if (hoverAtStartTagName || hoverAtEndTagName) {
        return {
            type: 'tagName',
            name: tagName,
            tagName,
            parentTagName,
            attrNames,
        };
    }

    const attr = tag.attrs.find((attr) => cursorAt >= attr.name.start && cursorAt < attr.name.start + attr.name.text.length);
    if (attr) {
        return {
            type: 'attrName',
            name: camelCase(attr.name.text),
            tagName,
            parentTagName,
            attrNames,
        };
    }
}

export function getControllerNameInfoFromHtml(document: TextDocument): NgCtrlInfo | undefined {
    if (isComponentHtml(document)) {
        return;
    }

    const docText = document.getText();
    const pos = docText.indexOf('ng-controller=');
    if (pos < 0) {
        return;
    }

    const tag = getHtmlTagAt(docText, { at: pos, isHover: true });
    if (!tag) {
        return;
    }

    const attrValue = tag.attrs.find((attr) => attr.name.text === 'ng-controller')?.value;
    if (!attrValue) {
        return;
    }

    const result: NgCtrlInfo = getNgCtrlInfo(attrValue.text);

    console.log('getControllerNameFromHtml() find controller name info:', result);

    return result;
}

export function getNgCtrlInfo(text: string): NgCtrlInfo {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [controllerName, asKey, controllerAs] = text.split(/\s+/);
    return {
        controllerName,
        controllerAs,
    };
}

export function getOriginalFileName(fileName: string): string {
    // Remove leading `/` and ending `.html` to get original path.
    const originalPath = fileName.slice(1).slice(0, -5);
    return originalPath;
}

export async function getCorrespondingTsFileName(document: TextDocument, searchKey?: string): Promise<string | undefined> {
    if (isInlinedHtml(document)) {
        const originalPath = getOriginalFileName(document.fileName);
        let path = originalPath;
        if (os.platform() === 'win32') {
            // Here do not use normalizePath()
            path = path.replace(/\\/g, '/').slice('file:///'.length);
        } else {
            path = path.slice('file://'.length);
        }
        return normalizePath(path);
    }

    if (isComponentHtml(document)) {
        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';
        return tsFilePath;
    }

    const tsFiles = await getTsFiles(document.fileName, { fallbackCnt: 4, limit: searchKey ? undefined : 1 });
    if (searchKey) {
        const result = fuzzysort.go(searchKey, tsFiles, { limit: 1 });
        if (result.length) {
            const tsFilePath = result[0].target;
            console.log('getCorrespondingTsFileName() fuzzy search result:', tsFilePath);
            return tsFilePath;
        }
    }

    return tsFiles[0];
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

export function isNgCustomAttr(attrName: string): boolean {
    return attrName.includes('-') && !attrName.startsWith('data-') && attrName !== 'accept-charset';
}

export function isValidIdentifier(text: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z\d_$]*$/.test(text);
}

export function isComponentTagName(name: string): boolean {
    return name.includes('-') || !isHtmlTagName(name);
}

export async function checkServiceAndGetTsFilePath(document: TextDocument, port: number): Promise<string | undefined> {
    const tsFilePath = (await getCorrespondingTsFileName(document))!;

    if (!(await checkNgHelperServerRunning(tsFilePath, port))) {
        return;
    }

    return tsFilePath;
}
