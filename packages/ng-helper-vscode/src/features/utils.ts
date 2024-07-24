import { TextDocument } from 'vscode';

import { normalizePath } from '../utils';

export function isComponentHtml(document: TextDocument) {
    return document.fileName.endsWith('.component.html');
}

export function getCorrespondingTsFileName(document: TextDocument): string {
    if (isComponentHtml(document)) {
        // remove .html add .ts
        const tsFilePath = document.fileName.slice(0, -5) + '.ts';
        return tsFilePath;
    } else {
        // TODO 获取最接近的 ts 文件
        return document.fileName;
    }
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
