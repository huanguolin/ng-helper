import { getHtmlTagByCursor } from '@ng-helper/shared/lib/html';
import fuzzysort from 'fuzzysort';
import { TextDocument } from 'vscode';

import { getTsFiles, normalizePath } from '../utils';

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function getControllerNameFromHtml(document: TextDocument): string | undefined {
    if (isComponentHtml(document)) {
        throw new Error('Component html should not use this function!');
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

    const ctrlName = attrValue.text.split(/\s+/).shift();

    console.log('getControllerNameFromHtml() find controller name is:', ctrlName);

    return ctrlName;
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

export function getComponentName(document: TextDocument): string | undefined {
    if (!isComponentHtml(document)) {
        return;
    }

    const fileName = normalizePath(document.fileName).split('/').pop();
    return fileName?.replace('.component.html', '');
}

export function isNgDirectiveAttr(attrName: string): boolean {
    return attrName.startsWith('ng-');
}

export function isComponentTag(tagName: string): boolean {
    return tagName.includes('-');
}

export function isValidIdentifier(text: string): boolean {
    return /^[a-zA-Z_$][a-zA-Z\d_$]*$/.test(text);
}
