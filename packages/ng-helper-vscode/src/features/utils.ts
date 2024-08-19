import { getHtmlTagByCursor, isHtmlTagName } from '@ng-helper/shared/lib/html';
import { NgCtrlInfo, NgElementHoverInfo } from '@ng-helper/shared/lib/plugin';
import { camelCase } from 'change-case';
import fuzzysort from 'fuzzysort';
import { TextDocument } from 'vscode';

import { getTsFiles, normalizePath } from '../utils';

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function getHoveredComponentNameOrAttr(document: TextDocument, cursorAt: number): NgElementHoverInfo | undefined {
    const docText = document.getText();
    const tag = getHtmlTagByCursor(docText, { at: cursorAt, isHover: true });
    if (!tag || !isComponentTagName(tag.tagName)) {
        return;
    }

    const hoverAtStartTagName = cursorAt > tag.start && cursorAt < tag.start + tag.tagName.length;
    const hoverAtEndTagName = tag.endTagStart !== undefined && cursorAt > tag.endTagStart + 1 && cursorAt < tag.end;
    if (hoverAtStartTagName || hoverAtEndTagName) {
        return {
            type: 'tagName',
            name: camelCase(tag.tagName),
            tagName: camelCase(tag.tagName),
            parentTagName: tag.parent?.tagName && camelCase(tag.parent?.tagName),
        };
    }

    const attr = tag.attrs.find((attr) => cursorAt >= attr.name.start && cursorAt < attr.name.start + attr.name.text.length);
    if (attr) {
        return {
            type: 'attrName',
            name: camelCase(attr.name.text),
            tagName: camelCase(tag.tagName),
            parentTagName: tag.parent?.tagName && camelCase(tag.parent?.tagName),
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

    const tag = getHtmlTagByCursor(docText, { at: pos, isHover: true });
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

export async function getCorrespondingTsFileName(document: TextDocument, searchKey?: string): Promise<string | undefined> {
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
    const kebabName = fileName?.replace('.component.html', '');
    return kebabName ? camelCase(kebabName) : undefined;
}

export function isNgDirectiveAttr(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isValidIdentifier(text: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z\d_$]*$/.test(text);
}

export function isComponentTagName(name: string): boolean {
    return name.includes('-') || !isHtmlTagName(name);
}
